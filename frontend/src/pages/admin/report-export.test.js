import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMonths,monthPeriod,csvText,exportRows} from './report-export.js';
test('calendar reporting uses month boundaries, leap years and no future dates',()=>{
  assert.deepEqual(monthPeriod('2024-02','2026-09-09'),{start:'2024-02-01',end:'2024-02-29'});
  assert.deepEqual(monthPeriod('2026-09','2026-09-09'),{start:'2026-09-01',end:'2026-09-09'});
  assert.equal(calendarMonths('2026','2026-09-09').length,9);
  assert.equal(calendarMonths('2025','2026-09-09').length,12);
});
test('complete dashboard export retains unlinked tenants, failures, coverage and live snapshot',()=>{
  const report={period:{start:'2026-09-01',end:'2026-09-09'},summary:{calls:21},coverage:{vapiComplete:false},tenants:[{id:'one',name:'First'},{id:'unlinked',name:'=FORMULA'}],calls:Array.from({length:21},(_,id)=>({id,source:'vapi',cost:null})),failedCalls:[{id:'leg',source:'twilio',reason:'busy'}],providers:{twilio:{total:{amount:2,currency:'USD'}}},notes:['Partial data'],distributions:{plans:[]}};
  const rows=exportRows([report],{generatedAt:'now',calls:[]});
  assert.ok(rows.some(r=>r[1]==='Calls'&&r[2]==='vapi:20'));
  assert.ok(rows.some(r=>r[1]==='Failed calls'&&r[2]==='twilio:leg'));
  assert.ok(rows.some(r=>r[1]==='Coverage'&&r[4]===false));
  assert.ok(rows.some(r=>r[1]==='Live usage'));
  assert.ok(csvText(rows).includes("'=FORMULA"));
  assert.ok(csvText([['a"b','x\ny','+SUM(1)']]).includes('a""b'));
});
