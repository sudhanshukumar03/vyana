import { expect, it } from 'vitest';
import { conversationHistory, readReport, type AssistantMessage } from './assistant';

it('keeps report content, failed replies and request errors out of model history', () => {
  const messages: AssistantMessage[] = [
    {role:'user',kind:'chat',content:'Explain steps'},
    {role:'assistant',kind:'chat',content:'Steps count walking movements',metadata:{source:'gemini',offline:false,
      reason:null,retry_after_seconds:null,disclaimer:'Wellness only',sections:[{title:'Next steps',items:['Check your device source']}]}},
    {role:'user',kind:'report',content:'Private report filename'},
    {role:'assistant',kind:'report',content:'Private report summary'},
    {role:'assistant',kind:'error',content:'Request failed'},
    {role:'assistant',kind:'chat',content:'Fallback information',metadata:{source:'fallback',offline:true,
      reason:'unavailable',retry_after_seconds:null,disclaimer:'Wellness only',sections:[]}},
  ];
  expect(conversationHistory(messages)).toEqual([{role:'user',content:'Explain steps'},
    {role:'assistant',content:'Steps count walking movements\n\nNext steps\nCheck your device source'}]);
});

it('bounds Unicode history by bytes and by turns before transport', () => {
  const messages = Array.from({length:20}, (): AssistantMessage => ({role:'user',kind:'chat',content:'\u{1F600}'.repeat(4000)}));
  const history = conversationHistory(messages);
  expect(history.length).toBeGreaterThan(0);
  expect(history.length).toBeLessThanOrEqual(8);
  expect(new TextEncoder().encode(JSON.stringify(history)).length).toBeLessThanOrEqual(60000);
  expect(history.every(turn=>turn.content.length<=8000)).toBe(true);
});

it('reads a report without retaining its data URL and supports cancellation', async () => {
  const encoded = await readReport(new File(['%PDF-synthetic'],'report.pdf',{type:'application/pdf'}),new AbortController().signal);
  expect(atob(encoded)).toBe('%PDF-synthetic');
  const controller = new AbortController();controller.abort();
  await expect(readReport(new File(['synthetic'],'report.pdf'),controller.signal)).rejects.toMatchObject({name:'AbortError'});
});
