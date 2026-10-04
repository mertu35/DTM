const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const copy = x => JSON.parse(JSON.stringify(x));
const store = new Map(); let failQuery = false, counter = 0, opened = [], blobs = [], download = 0;
function doc(path) { return { id:path.split('/').at(-1), path,
 collection: name => collection(path+'/'+name), async get(){return snap(path);},
 async set(data){store.set(path,copy(data));},async delete(){store.delete(path);} }; }
function snap(path){return {id:path.split('/').at(-1),ref:doc(path),exists:store.has(path),data:()=>copy(store.get(path))};}
function collection(path){return {doc:id=>doc(path+'/'+(id||'id'+(++counter))),orderBy(){return this;},async get(){
 if(failQuery && path.endsWith('/dosyalar')) throw new Error('Network failure');
 const docs = [...store.keys()].filter(p=>p.startsWith(path+'/')&&p.split('/').length===path.split('/').length+1).map(snap).sort((a,b)=>(a.data().index||0)-(b.data().index||0));
 return {docs,size:docs.length,empty:!docs.length};
}};}
function mutations(){const pending=[];return {set(ref,data){pending.push(()=>store.set(ref.path,copy(data)));},update(ref,data){pending.push(()=>store.set(ref.path,{...store.get(ref.path),...copy(data)}));},delete(ref){pending.push(()=>store.delete(ref.path));},async commit(){pending.forEach(f=>f());}};}
const db={collection,doc,batch:mutations,async runTransaction(fn){const tx=mutations();tx.get=ref=>ref.get();const result=await fn(tx);await tx.commit();return result;}};
const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=> 'SERVER_TIME'};
class Reader {readAsDataURL(file){this.onload({target:{result:file.data}});}}
const context=vm.createContext({console,Blob,atob,FileReader:Reader,setTimeout(){},firebaseConfig:{},
 URL:{createObjectURL(blob){blobs.push(blob);return 'blob:safe';},revokeObjectURL(){}},
 document:{createElement(){return {click(){download++;}};}},window:{open(url){opened.push(url);return {opener:{}};}},
 firebase:{initializeApp(){},auth:()=>({currentUser:{uid:'owner'}}),firestore}});
vm.runInContext(fs.readFileSync('app/js/firebase.js','utf8'),context);
vm.runInContext("currentDTMUser = {uid:'owner',role:'user',displayName:'Owner'}",context);
const header='data:application/pdf;base64,';
function reset(){store.clear();store.set('projeler/p',{userId:'owner',status:'taslak',revision:0,data:{}});}
async function main(){
 reset();
 const first=await context.projeDosyaYukle('p',{name:'test.pdf',type:'application/pdf',size:3,data:header+'YWJj'});
 assert.equal(store.get(first).tip,'application/pdf');assert.equal(store.get(first).boyut,3);
 await assert.rejects(context.projeDosyaYukle('p',{name:'fake.pdf',type:'text/html',size:3}),/desteklenmiyor/);
 await assert.rejects(context.projeDosyaYukle('p',{name:'huge.pdf',type:'application/pdf',size:5242881}),/5 MB/);
 const full=header+Buffer.alloc(5242880).toString('base64');
 const second=await context.projeDosyaYukle('p',{name:'big.pdf',type:'application/pdf',size:5242880,data:full});
 assert.equal(store.get(second).parcaSayisi,10);
 assert.equal(await context.projeDosyaIcerigiGetir('p',second.split('/').at(-1),store.get(second)),full);
 store.delete(second+'/parcalar/009');await assert.rejects(context.projeDosyaIcerigiGetir('p',second.split('/').at(-1),store.get(second)),/eksik/);
 context.compressImage=async()=> 'data:image/jpeg;base64,YWJj';
 const image=await context.projeDosyaYukle('p',{name:'photo.png',type:'image/png',size:10});
 assert.equal(store.get(image).ad,'photo.jpg');assert.equal(store.get(image).tip,'image/jpeg');assert.equal(store.get(image).boyut,3);
 context.window.projeDosyaGoruntule(header+'YWJj','safe.pdf','text/html');assert.equal(blobs.at(-1).type,'application/pdf');
 assert.throws(()=>context.window.projeDosyaGoruntule('data:text/html;base64,YWJj','fake.html','text/html'),/desteklenmiyor/);
 const n=opened.length;context.window.projeDosyaGoruntule('data:application/msword;base64,YWJj','safe.doc','text/html');assert.equal(opened.length,n);assert.equal(download,1);
 await context.deleteProjeFromCloud('p');assert.equal(store.size,0,'project, metadata and remaining chunks deleted together');
 reset();store.set('projeler/p/dosyalar/file',{data:'keep'});failQuery=true;
 await assert.rejects(context.deleteProjeFromCloud('p'),/Network failure/);failQuery=false;
 assert.equal(store.get('projeler/p').deleting,false);assert.equal(store.get('projeler/p/dosyalar/file').data,'keep');
 reset();for(let i=0;i<451;i++)store.set('projeler/p/dosyalar/f'+i,{data:'keep'});
 await assert.rejects(context.deleteProjeFromCloud('p'),/çok sayıda/);assert.equal(store.size,452);assert.equal(store.get('projeler/p').deleting,false);
 reset();store.set('projeler/p',{...store.get('projeler/p'),status:'onaylandi',kazananBasitUsul:false,belgeReferans:{version:1,firmaList:[],yukleniciList:[]}});
 const frozen=await context.getProjeFromCloud('p');assert.equal(frozen.data.belgeReferans.version,1);assert.equal(frozen.data.kayitliKazananBasitUsul,false);
 store.get('projeler/p').status='geri_gonderildi';const returned=await context.getProjeFromCloud('p');assert.equal(returned.data.belgeReferans,undefined);
 console.log('PASS: upload/read/limits, JPEG metadata, safe preview, atomic cleanup, failed/large deletion recovery and active/draft snapshots');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
