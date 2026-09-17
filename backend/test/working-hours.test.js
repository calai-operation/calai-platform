import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTimeToMinutes,isBusinessCurrentlyOpen} from '../src/app/utils/business-hours.js';
test('working hours parse both saved 12-hour and 24-hour formats',()=>{
 assert.equal(parseTimeToMinutes('09:30 AM'),570);assert.equal(parseTimeToMinutes('10:15 PM'),1335);assert.equal(parseTimeToMinutes('22:15'),1335);assert.equal(parseTimeToMinutes(null),null);
});
test('London hours decide online and offline status at exact boundaries',()=>{
 const settings={openingTime:'09:00 AM',closingTime:'05:00 PM',offDays:[]};
 assert.equal(isBusinessCurrentlyOpen(settings,new Date('2026-09-09T07:59:00Z')),false);
 assert.equal(isBusinessCurrentlyOpen(settings,new Date('2026-09-09T08:00:00Z')),true);
 assert.equal(isBusinessCurrentlyOpen(settings,new Date('2026-09-09T16:00:00Z')),false);
});
test('overnight hours, days off and daylight-saving changes are handled in London time',()=>{
 const overnight={openingTime:'10:00 PM',closingTime:'06:00 AM',offDays:[]};
 assert.equal(isBusinessCurrentlyOpen(overnight,new Date('2026-09-09T22:30:00Z')),true);
 assert.equal(isBusinessCurrentlyOpen(overnight,new Date('2026-09-09T12:00:00Z')),false);
 assert.equal(isBusinessCurrentlyOpen({...overnight,offDays:['Wednesday']},new Date('2026-09-09T22:30:00Z')),false);
 const winter={openingTime:'09:00',closingTime:'17:00',offDays:[]};
 assert.equal(isBusinessCurrentlyOpen(winter,new Date('2026-12-09T09:30:00Z')),true);
});
test('equal hours mean always open and missing settings retain the existing open default',()=>{
 assert.equal(isBusinessCurrentlyOpen({openingTime:'12:00 AM',closingTime:'12:00 AM',offDays:[]}),true);
 assert.equal(isBusinessCurrentlyOpen({openingTime:null,closingTime:null,offDays:[]}),true);
});
