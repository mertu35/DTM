const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
let notices=[], sent=0, reads=0;
const ctx=vm.createContext({console,setTimeout(){},clearTimeout(){},localStorage:{getItem(){return null;},setItem(){}},
 document:{getElementById(id){return id==='gerceklestirmeciSelect'?{value:'reviewer',selectedIndex:0,options:[{dataset:{ad:'Reviewer'}}]}:{remove(){}};},createElement(){return {};},head:{appendChild(){}},addEventListener(){}},
 window:{addEventListener(){}},projeSurumleri:new Map([['p',0]]),projeCakismaHatasi:()=>new Error('Conflict')});
for(const file of ['data','utils','calculations','app'])vm.runInContext(fs.readFileSync(`app/js/${file}.js`,'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
const data=Object.assign(ctx.getDefaultProje(),{isAdi:'Çatı',teklifFirmalar:[{ad:'A',fiyatlar:[200000]}],kazananFirmaIndex:0});
ctx.doc={data,revision:0};ctx.r={firmaList:[{ad:'A',basitUsul:false}],yukleniciList:[]};ctx.input=data;
ctx.getProjeFromCloud=async()=>{reads++;return ctx.doc;};ctx.gonderiProje=async()=>{sent++;};
run("showToast = message => {}; renderPage=()=>{}; butonKilitli=async (b,t,fn)=>fn(); referans=r;");ctx.showToast=m=>notices.push(m);
function reset(){ctx.input=JSON.parse(JSON.stringify(data));run("proje=input;currentCloudProjeId='p';currentProjeStatus='taslak';currentProjeKilitli=false;lastSavedProjeSnapshot=JSON.stringify(proje);");}
async function main(){
 reset();run("proje.isAdi='Unsaved'");await ctx.gonderiOnayla('p',{});assert.equal(sent,0);assert.equal(reads,0);assert.match(notices.at(-1),/kaydediniz/);
 reset();ctx.doc.revision=1;await ctx.gonderiOnayla('p',{});assert.equal(sent,0);assert.match(notices.at(-1),/Conflict/);
 reset();ctx.doc.revision=0;await ctx.gonderiOnayla('p',{});assert.equal(sent,1);
 assert.equal(run('currentProjeStatus'),'gonderildi');assert.equal(run('currentProjeKilitli'),true);assert.equal(run('hasUnsavedChanges()'),false);
 ctx.r.firmaList[0].basitUsul=true;assert.equal(run('hesaplaSozlesmeVergileri(proje,referans).kdvOrani'),20,'open screen freezes immediately after sending');
 console.log('PASS: unsaved/stale submission blocked and current screen freezes on successful submission');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
