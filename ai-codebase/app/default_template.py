"""New agents inherit Testing Curry without copying its menu or phone routing."""
import copy
import re
import requests

TEMPLATE_ID = '70202223-f39f-4275-90c8-d0e6c4c21f62'
READ_ONLY = {'id', 'orgId', 'createdAt', 'updatedAt', 'latestVersion', 'isServerUrlSecretSet'}


def replace_business(value, name):
    if isinstance(value, str):
        return value.replace('Testing Curry', name)
    if isinstance(value, list):
        return [replace_business(item, name) for item in value]
    if isinstance(value, dict):
        return {key: replace_business(item, name) for key, item in value.items()}
    return value


def template_payload(template, tools, agent_name, business_name, menu_text):
    if template.get('id') != TEMPLATE_ID or template.get('name') != 'Testing Curry':
        raise ValueError('Testing Curry template identity could not be verified')
    if not menu_text or not menu_text.strip():
        raise ValueError('A readable menu is required for the new agent')
    payload = replace_business({k: copy.deepcopy(v) for k, v in template.items() if k not in READ_ONLY}, business_name)
    payload['name'] = agent_name
    payload['metadata'] = {'business_id': agent_name, 'default_template_source': TEMPLATE_ID}
    replaced = 0
    pattern = r'(16\. MENU DATA\s*\n=+\s*\n).*?(\n=+\s*\n17\. OFFERS AND PRIORITY)'
    for message in payload['model'].get('messages', []):
        if message.get('role') == 'system':
            message['content'], count = re.subn(pattern, lambda m: m.group(1) + menu_text.strip() + '\n' + m.group(2), message.get('content', ''), flags=re.S)
            replaced += count
    if replaced != 1:
        raise ValueError('Testing Curry menu section changed; template needs review before creating an agent')
    # Shared save_order is tenant-aware. Closing messages are embedded per agent;
    # the normal telephony setup supplies each business's own transfer destination.
    ids, inline = [], payload['model'].get('tools', [])
    for tool_id in template['model'].get('toolIds', []):
        tool = tools[tool_id]
        if tool.get('type') == 'transferCall':
            continue
        if tool.get('type') == 'endCall':
            inline.append(replace_business({k: copy.deepcopy(v) for k, v in tool.items() if k not in READ_ONLY}, business_name))
        else:
            ids.append(tool_id)
    payload['model']['toolIds'] = ids
    if inline:
        payload['model']['tools'] = inline
    # Knowledge-base attachments, if introduced later, must not carry the old menu.
    if payload['model'].get('knowledgeBase') or payload['model'].get('knowledgeBaseId'):
        raise ValueError('Template has a knowledge base; review its menu isolation before creating an agent')
    return payload


def create_from_testing_curry(agent_name, business_name, menu_text, headers):
    base = 'https://api.vapi.ai'
    def get(path):
        response = requests.get(base + path, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    # Fail closed if an existing assistant has the requested name.
    if any(a.get('name') == agent_name for a in get('/assistant')):
        raise ValueError('An assistant with this name already exists; choose a new name')
    template = get('/assistant/' + TEMPLATE_ID)
    tools = {tool_id: get('/tool/' + tool_id) for tool_id in template['model'].get('toolIds', [])}
    payload = template_payload(template, tools, agent_name, business_name, menu_text)
    response = requests.post(base + '/assistant', headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()
