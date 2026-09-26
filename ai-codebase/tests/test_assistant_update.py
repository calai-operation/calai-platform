import contextlib
from copy import deepcopy
import importlib
import io
import sys
import types
import unittest
from unittest.mock import Mock, patch

from app.services.assistant_update import build_existing_assistant_update, retain_payment_policy


def prompt(menu="NEW MENU", offers="NEW OFFERS", rules="NEW RULES", payment="OLD PAYMENT", closing="OLD CLOSING", legacy=False):
    text = f"Business identity and rules: {rules}\n"
    for n, title, body in [(11,"DELIVERY PAYMENT",payment),(12,"SAVE_ORDER","SAVE CONTRACT"),(15,"COMPLETED ORDER CLOSING",closing),(16,"MENU DATA",menu),(17,"OFFERS AND PRIORITY",offers)]:
        text += f"{n}. {title}\n==================================================\n\n{body}\n\n"
    if legacy:
        text += "CALL OUTCOME ROUTING — takes precedence over earlier closing/transfer wording only. Preserve menu.\n1. Collection invokes endCall.\n2. Never use manager fallback.\n"
    return text


def assistant():
    return {
        "id":"assistant-1", "name":"business-1", "metadata":{"business_id":"business-1","custom":"keep"},
        "firstMessage":"Hi, you're through to Original Restaurant and I'm their virtual assistant. Would you like to place an order?",
        "transcriber":{"provider":"deepgram","model":"nova-3","keyterm":["card","pay by card"]},
        "messagePlan":{"idleTimeoutSeconds":8,"idleMessages":["Helpful recovery"]},
        "hooks":[{"on":"customer.speech.timeout"}],
        "voice":{"voiceId":"custom"},
        "server":{"url":"https://existing.example/webhook"},
        "model":{
            "provider":"openai","model":"custom-model","temperature":0.2,
            "messages":[{"role":"system","content":prompt(menu="PRIVATE OLD MENU",offers="PRIVATE OLD OFFERS",rules="OLD BUSINESS RULES",payment="REMEMBER CARD ONCE",closing="ALL CARD INCLUDING COLLECTION: transferForCardPayment. Definite failure: one manager fallback. Unknown: no duplicate transfer.")},{"role":"assistant","content":"Existing context"}],
            "toolIds":["shared-card-v9","other-business-tool"],
            "tools":[
                {"type":"transferCall","function":{"name":"transferToManager"},"messages":[{"type":"request-failed","content":"Retain recovery"}],"destinations":[{"type":"number","number":"+441111111111","message":"Contact Original Restaurant","transferPlan":{"mode":"blind-transfer"}}]},
                {"type":"endCall","messages":[{"type":"request-start","content":"Thank you Original Restaurant"}]},
                {"type":"apiRequest","function":{"name":"save_order"},"server":{"headers":{"secret":"do-not-log-this"}}},
            ],
        },
    }


def generated():
    return {"name":"business-1","firstMessage":"Hi, you're through to New Restaurant and I'm their virtual assistant. Would you like to place an order?","model":{"provider":"generated-provider","messages":[{"role":"system","content":prompt(legacy=True)}],"tools":[],"toolIds":["wrong-default"]},"transcriber":{"keyterm":["legacy"]}}


class UpdatePolicyTests(unittest.TestCase):
    def test_dynamic_menu_offers_rules_change_while_own_payment_and_recovery_stay(self):
        old=assistant();before=deepcopy(old)
        out=build_existing_assistant_update(old,generated(),"business-1")
        text=out["model"]["messages"][0]["content"]
        for expected in ["NEW MENU","NEW OFFERS","NEW RULES","REMEMBER CARD ONCE","ALL CARD INCLUDING COLLECTION","Definite failure: one manager fallback","Unknown: no duplicate transfer"]:
            self.assertIn(expected,text)
        for stale in ["PRIVATE OLD MENU","PRIVATE OLD OFFERS","OLD BUSINESS RULES","OLD PAYMENT","OLD CLOSING"]:
            self.assertNotIn(stale,text)
        self.assertEqual(old,before)

    def test_existing_model_tools_messages_and_shared_ids_are_preserved(self):
        old=assistant();out=build_existing_assistant_update(old,generated(),"business-1")
        self.assertEqual(set(out),{"model"})
        for key in ["provider","model","temperature","tools","toolIds"]:
            self.assertEqual(out["model"][key],old["model"][key])
        self.assertEqual(out["model"]["messages"][1],old["model"]["messages"][1])
        applied={**old,**out}
        for key in ["transcriber","messagePlan","hooks","voice","server","firstMessage"]:
            self.assertEqual(applied[key],old[key])

    def test_legacy_priority_cannot_override_collection_card_or_failure_rules(self):
        out=build_existing_assistant_update(assistant(),generated(),"business-1")
        text=out["model"]["messages"][0]["content"]
        self.assertNotIn("takes precedence over earlier closing/transfer wording only",text)
        self.assertIn("Sections 11 and 15 take precedence over these examples",text)
        self.assertTrue(text.endswith("Follow their card-payment routing and their exact failure/unknown-result recovery rules.\n"))
        self.assertIn("ALL CARD INCLUDING COLLECTION",text)
        self.assertIn("Definite failure: one manager fallback",text)
        self.assertIn("Unknown: no duplicate transfer",text)

    def test_missing_old_sections_leave_generated_prompt_intact(self):
        self.assertEqual(retain_payment_policy(prompt(),"A legacy unsectioned prompt"),prompt())
        self.assertEqual(retain_payment_policy("Unsectioned new prompt",prompt()),"Unsectioned new prompt")

    def test_unbounded_or_wrongly_numbered_section_never_copies_old_menu(self):
        broken=prompt().replace("16. MENU DATA", "16. SOMETHING ELSE")
        out=retain_payment_policy(prompt(),broken)
        self.assertNotIn("PAYMENT AND CLOSING PRIORITY",out)
        duplicate=prompt()+"15. COMPLETED ORDER CLOSING\n==================================================\nPRIVATE"
        self.assertNotIn("PRIVATE",retain_payment_policy(prompt(),duplicate))

    def test_policy_overlay_does_not_accumulate_on_repeated_updates(self):
        first=retain_payment_policy(prompt(legacy=True),assistant()["model"]["messages"][0]["content"])
        second=retain_payment_policy(prompt(menu="NEWEST MENU",legacy=True),first)
        self.assertEqual(second.count("PAYMENT AND CLOSING PRIORITY"),1)
        self.assertIn("NEWEST MENU",second)
        self.assertNotIn("PRIVATE OLD MENU",second)

    def test_omitted_manager_keeps_real_destination_and_explicit_manager_changes_only_number(self):
        old=assistant()
        same=build_existing_assistant_update(old,generated(),"business-1")
        self.assertEqual(same["model"]["tools"],old["model"]["tools"])
        changed=build_existing_assistant_update(old,generated(),"business-1",manager_number=" +442222222222 ")
        expected=deepcopy(old["model"]["tools"]);expected[0]["destinations"][0]["number"]="+442222222222"
        self.assertEqual(changed["model"]["tools"],expected)

    def test_explicit_manager_fails_closed_when_destination_is_ambiguous(self):
        old=assistant();old["model"]["tools"][0]["destinations"].append({"type":"number","number":"+443333333333"})
        with self.assertRaisesRegex(ValueError,"destination"):
            build_existing_assistant_update(old,generated(),"business-1",manager_number="+442222222222")

    def test_unchanged_business_name_preserves_greeting_and_tool_announcements(self):
        old=assistant();out=build_existing_assistant_update(old,generated(),"business-1",business_name="Original Restaurant")
        self.assertNotIn("firstMessage",out)
        self.assertEqual(out["model"]["tools"],old["model"]["tools"])
        self.assertEqual(out["metadata"]["custom"],"keep")

    def test_explicit_business_rename_updates_greeting_and_announcement_name_only(self):
        old=assistant();out=build_existing_assistant_update(old,generated(),"business-1",business_name="New Restaurant")
        self.assertEqual(out["firstMessage"],generated()["firstMessage"])
        self.assertEqual(out["model"]["tools"][1]["messages"][0]["content"],"Thank you New Restaurant")
        self.assertEqual(out["model"]["tools"][0]["destinations"][0]["number"],"+441111111111")

    def test_live_name_based_metadata_keeps_custom_greeting_without_display_name(self):
        old=assistant();old["name"]="Testing Curry";old["metadata"]={"business_id":"Testing Curry"}
        old["firstMessage"]="Welcome, how can I help with your order today?"
        out=build_existing_assistant_update(old,generated(),"Testing Curry",business_name="Testing Curry")
        self.assertNotIn("firstMessage",out)
        self.assertEqual(out["model"]["tools"],old["model"]["tools"])
        self.assertEqual(out["metadata"]["business_id"],"Testing Curry")
        self.assertEqual(out["metadata"]["business_name"],"Testing Curry")

    def test_custom_greeting_known_display_name_honours_explicit_rename(self):
        old=assistant();old["metadata"]["business_name"]="Original Restaurant"
        old["firstMessage"]="Welcome to Original Restaurant, how can I help?"
        out=build_existing_assistant_update(old,generated(),"business-1",business_name="New Restaurant")
        self.assertEqual(out["firstMessage"],"Welcome to New Restaurant, how can I help?")

    def test_legacy_priority_hyphen_variants_are_removed(self):
        for dash in ["-","–","—"]:
            incoming=prompt(legacy=True).replace("ROUTING —", "ROUTING "+dash)
            out=retain_payment_policy(incoming,assistant()["model"]["messages"][0]["content"])
            self.assertNotIn("takes precedence over earlier",out)

    def test_wrong_business_missing_model_or_ambiguous_prompt_fails_closed(self):
        cases=[{}, {"id":"assistant-1"}, {**assistant(),"name":"other","metadata":{} }]
        multi=assistant();multi["model"]["messages"].append({"role":"system","content":"other"});cases.append(multi)
        for old in cases:
            with self.assertRaises(ValueError):build_existing_assistant_update(old,generated(),"business-1")


class ServiceIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config=types.ModuleType("app.config")
        for k,v in {"VAPI_BASE_URL":"https://vapi.invalid","VAPI_HEADERS":{"Authorization":"test"},"LLM_MODEL":"test-model","TWILIO_ACCOUNT_SID":"test","TWILIO_AUTH_TOKEN":"test","get_vapi_server_url":lambda:"https://webhook.invalid"}.items():setattr(config,k,v)
        with patch.dict(sys.modules,{"app.config":config}):
            sys.modules.pop("app.services.vapi_service",None)
            cls.service=importlib.import_module("app.services.vapi_service")

    def test_existing_update_fetches_own_config_and_never_posts_new_assistant(self):
        old=assistant();listing=Mock(status_code=200);listing.json.return_value=[old]
        detail=Mock(status_code=200);detail.json.return_value=old
        saved=Mock(status_code=200);saved.json.return_value={"id":"assistant-1"}
        stdout=io.StringIO()
        with patch.object(self.service.requests,"get",side_effect=[listing,detail]) as get,patch.object(self.service.requests,"patch",return_value=saved) as send,patch.object(self.service.requests,"post") as post,contextlib.redirect_stdout(stdout):
            result=self.service.create_assistant("business-1",prompt(legacy=True),business_name="Original Restaurant")
        self.assertEqual(result,{"id":"assistant-1"});post.assert_not_called()
        self.assertEqual(get.call_args_list[1].args[0],"https://vapi.invalid/assistant/assistant-1")
        payload=send.call_args.kwargs["json"]
        self.assertNotIn("transcriber",payload);self.assertNotIn("messagePlan",payload)
        self.assertEqual(payload["model"]["toolIds"],old["model"]["toolIds"])
        self.assertNotIn("do-not-log-this",stdout.getvalue())

    def test_missing_current_config_does_not_patch_or_create(self):
        listing=Mock(status_code=200);listing.json.return_value=[assistant()]
        detail=Mock(status_code=503)
        with patch.object(self.service.requests,"get",side_effect=[listing,detail]),patch.object(self.service.requests,"patch") as send,patch.object(self.service.requests,"post") as post:
            with self.assertRaises(Exception):self.service.create_assistant("business-1",prompt())
        send.assert_not_called();post.assert_not_called()

    def test_ambiguous_business_match_does_not_patch_or_create(self):
        listing=Mock(status_code=200);listing.json.return_value=[assistant(),{**assistant(),"id":"assistant-2"}]
        with patch.object(self.service.requests,"get",return_value=listing),patch.object(self.service.requests,"patch") as send,patch.object(self.service.requests,"post") as post:
            with self.assertRaises(Exception):self.service.create_assistant("business-1",prompt())
        send.assert_not_called();post.assert_not_called()

    def test_failed_or_malformed_lookup_never_creates_replacement_assistant(self):
        unavailable=Mock(status_code=503)
        malformed=Mock(status_code=200);malformed.json.return_value={"unexpected":"response"}
        missing_id=Mock(status_code=200);missing_id.json.return_value=[{**assistant(),"id":None}]
        for result in [unavailable,malformed,missing_id]:
            with patch.object(self.service.requests,"get",return_value=result),patch.object(self.service.requests,"patch") as send,patch.object(self.service.requests,"post") as post:
                with self.assertRaises(Exception):self.service.create_assistant("business-1",prompt())
            send.assert_not_called();post.assert_not_called()
        with patch.object(self.service.requests,"get",side_effect=RuntimeError("Unavailable")),patch.object(self.service.requests,"patch") as send,patch.object(self.service.requests,"post") as post:
            with self.assertRaises(Exception):self.service.create_assistant("business-1",prompt())
        send.assert_not_called();post.assert_not_called()

    def test_new_assistant_creation_payload_keeps_existing_behavior(self):
        listing=Mock(status_code=200);listing.json.return_value=[]
        saved=Mock(status_code=200);saved.json.return_value={"id":"new"}
        with patch.object(self.service.requests,"get",return_value=listing),patch.object(self.service.requests,"patch") as send,patch.object(self.service.requests,"post",return_value=saved) as post,contextlib.redirect_stdout(io.StringIO()):
            self.service.create_assistant("new-business",prompt(),business_name="New Restaurant")
        send.assert_not_called();payload=post.call_args.kwargs["json"]
        self.assertEqual(payload["name"],"new-business")
        self.assertEqual(payload["model"]["messages"][0]["content"],prompt())
        self.assertEqual(payload["transcriber"]["keyterm"],["Biyrani, Peshwari","Nan","naan","Jalfrazi"])
        self.assertEqual(payload["model"]["tools"][0]["destinations"][0]["number"],"+447414500191")


if __name__ == "__main__":
    unittest.main()
