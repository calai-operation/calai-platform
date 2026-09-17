import test from 'node:test';
import assert from 'node:assert/strict';
import {weekRange,orderInRange,londonDate} from './order-dates.js';
test('business week is Monday to Sunday including Sunday and year boundaries',()=>{
  assert.deepEqual(weekRange('2026-09-09T10:00:00Z'),{start:'2026-09-07',end:'2026-09-13'});
  assert.deepEqual(weekRange('2026-09-13T10:00:00Z'),{start:'2026-09-07',end:'2026-09-13'});
  assert.deepEqual(weekRange('2026-01-01T10:00:00Z'),{start:'2025-12-29',end:'2026-01-04'});
  assert.deepEqual(weekRange('2026-09-09T10:00:00Z',-1),{start:'2026-08-31',end:'2026-09-06'});
});
test('date filters include London midnight, handle daylight savings and preserve all-dates access',()=>{
  const range={start:'2026-09-07',end:'2026-09-13'};
  assert.equal(londonDate('2026-09-06T23:15:00Z'),'2026-09-07');
  assert.equal(orderInRange({createdAt:'2026-09-06T23:15:00Z'},range),true);
  assert.equal(orderInRange({createdAt:'2026-09-13T23:15:00Z'},range),false);
  assert.equal(orderInRange({date:'07/09/2026'},range),true);
  assert.equal(orderInRange({date:'01/09/2026'},range),false);
  assert.equal(orderInRange({date:'01/09/2026'},{start:'',end:''}),true);
  assert.equal(londonDate('2026-10-25T01:30:00Z'),'2026-10-25');
});
