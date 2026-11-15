import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createCentralServer } from './server.mjs';
import { discoverModels } from './providerAccounts.mjs';
const cleanup=[];
const token='connection-fixture-token-123456789';
const secret='fixture-secret-never-real';
const payload={version:1,id:'comparison-task',operation:'studies.analyze',sourceFileId:'photo',promptVersion:'studies-v1',text:'',image:'data:image/png;base64,aGVsbG8='};
async function start() {
 const dataDir=await mkdtemp(join(tmpdir(),'alfred-connections-'));const calls=[];let quota=false;
 const providerFetch=async(url,options={})=>{
  calls.push({url,options});
  if(!options.method) return Response.json(url.includes('googleapis')?{models:[{name:'models/fixture-vision',supportedGenerationMethods:['generateContent']}]}:{data:[{id:'fixture-vision',active:true},{id:'whisper-audio',active:true}]});
  if(quota && url.includes('groq')) return Response.json({error:{message:secret}},{status:429});
  const result=JSON.stringify({text:'Mitose: divisão celular.',uncertainties:['Trecho apagado.']});
  return Response.json(url.includes('googleapis')?{candidates:[{content:{parts:[{text:result}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:12,candidatesTokenCount:8}}:{choices:[{message:{content:result},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5}});
 };
 const server=createCentralServer({token,allowedOrigins:['http://localhost:5173'],dataDir,providerFetch});server.listen(0,'127.0.0.1');await once(server,'listening');
 cleanup.push(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await rm(dataDir,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}`;
 const request=(path,method='GET',body,authorization=`Bearer ${token}`)=>fetch(url+path,{method,headers:{'Content-Type':'application/json',Authorization:authorization},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 async function connect(provider){let response=await request('/v1/connections','POST',{provider,label:provider,apiKey:secret,freeTierConfirmed:true});assert.equal(response.status,201);let {connection}=await response.json();response=await request('/v1/connections/'+connection.id,'PATCH',{model:'fixture-vision',freeTierConfirmed:true});assert.equal(response.status,200);return (await response.json()).connection;}
 return {request,connect,calls,dataDir,setQuota:()=>{quota=true;}};
}
afterEach(async()=>{for(const action of cleanup.splice(0))await action();});
test('protects connections and private inbox; rejects malformed input without disclosure',async()=>{const api=await start();for(const path of ['/v1/connections','/v1/tasks/missing'])assert.equal((await api.request(path,'GET',undefined,'Bearer wrong')).status,401);assert.equal((await api.request('/v1/connections','POST',null)).status,400);assert.equal((await api.request('/v1/connections','POST',{provider:'openai',label:'x',apiKey:secret,freeTierConfirmed:true})).status,400);assert.equal(api.calls.length,0);});
test('discovers without inference and stores encrypted credentials, returning metadata only',async()=>{const api=await start();const connection=await api.connect('gemini');assert.equal(api.calls.length,1);assert.equal(api.calls[0].options.method,undefined);const listed=await(await api.request('/v1/connections')).text();assert.ok(!listed.includes(secret));assert.ok(!listed.includes('apiKey'));assert.equal(connection.model,'fixture-vision');const disk=await readFile(join(api.dataDir,'.connections','accounts.enc'),'utf8');assert.ok(!disk.includes(secret));assert.ok(!disk.includes('fixture-vision'));assert.equal((await api.request('/health').then(r=>r.json())).ready,true);});
test('pins connection revision and requires free consent before inference',async()=>{const api=await start();const c=await api.connect('gemini');const task={...payload,connectionId:c.id,connectionRevision:c.revision};assert.equal((await api.request('/v1/tasks','POST',task)).status,402);assert.equal((await api.request('/v1/tasks','POST',{...task,freeTierConsent:true,connectionRevision:'old'})).status,409);assert.equal(api.calls.length,1);const response=await api.request('/v1/tasks','POST',{...task,freeTierConsent:true});assert.equal(response.status,200);assert.equal(api.calls.length,2);const body=JSON.parse(api.calls[1].options.body);assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/png');assert.ok(body.systemInstruction.parts[0].text.includes('JSON'));});
test('keeps the successful Gemini inbox response when Groq quota fails; recovers without inference',async()=>{const api=await start();const gemini=await api.connect('gemini'),groq=await api.connect('groq');const task={...payload,connectionId:gemini.id,connectionRevision:gemini.revision,freeTierConsent:true};const result=await(await api.request('/v1/tasks','POST',task)).json();api.setQuota();const failed=await api.request('/v1/tasks','POST',{...task,id:'groq-task',connectionId:groq.id,connectionRevision:groq.revision});assert.equal(failed.status,429);assert.ok(!(await failed.text()).includes(secret));const calls=api.calls.length;assert.deepEqual(await(await api.request('/v1/tasks/'+task.id)).json(),result);assert.equal(api.calls.length,calls);assert.equal((await api.request('/v1/tasks/groq-task')).status,404);const groqBody=JSON.parse(api.calls.at(-1).options.body);assert.equal(groqBody.messages[1].content[1].image_url.url,payload.image);});
test('Groq uses its selected model and refuses deleted connections without fallback',async()=>{const api=await start();const c=await api.connect('groq');assert.deepEqual(c.models,['fixture-vision']);const task={...payload,connectionId:c.id,connectionRevision:c.revision,freeTierConsent:true};const response=await api.request('/v1/tasks','POST',task);assert.equal(response.status,200);const output=await response.json();assert.equal(output.provider,'groq');assert.equal(output.usage.inputTokens,10);assert.equal(JSON.parse(api.calls[1].options.body).model,'fixture-vision');await api.request('/v1/connections/'+c.id,'DELETE');assert.equal((await api.request('/v1/tasks','POST',{...task,id:'another'})).status,409);assert.equal(api.calls.length,2);});
test('rejects provider authentication errors without exposing upstream content',async()=>{await assert.rejects(()=>discoverModels('gemini',secret,async()=>Response.json({error:secret},{status:403})),error=>error.status===422&&!error.message.includes(secret));});
