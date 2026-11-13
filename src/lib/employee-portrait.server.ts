import { FACE_PHOTO_MAX_BYTES, validateFacePortraitFile } from './employee-private-profile';
// Structural byte validation, not face recognition or a full pixel decoder.
export function verifyEmployeePortrait(bytes:Uint8Array,declaredMime:string) {
  validateFacePortraitFile({type:declaredMime,size:bytes.length});
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const ascii=(start:number,count:number)=>String.fromCharCode(...bytes.slice(start,start+count));
  const u24=(p:number)=>(bytes[p]??0)|((bytes[p+1]??0)<<8)|((bytes[p+2]??0)<<16);
  let mime=''; let width=0; let height=0;
  const invalid=()=>{throw new Error('PORTRAIT_BYTES_INVALID');};
  if(bytes.length>=45 && bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10') {
    mime='image/png'; let p=8; let data=false; let ended=false;
    while(p+12<=bytes.length){
      const n=view.getUint32(p),type=ascii(p+4,4);if(p+n+12>bytes.length)invalid();
      // Reject metadata rather than persisting EXIF/text containing private data.
      if(['eXIf','tEXt','zTXt','iTXt'].includes(type))invalid();
      let crc=0xffffffff;
      for(const b of bytes.slice(p+4,p+8+n)){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
      if(((crc^0xffffffff)>>>0)!==view.getUint32(p+8+n))invalid();
      if(p===8){if(type!=='IHDR'||n!==13)invalid();width=view.getUint32(p+8);height=view.getUint32(p+12);}
      if(type==='IDAT' && n>0)data=true;
      p+=n+12;
      if(type==='IEND'){if(n!==0||p!==bytes.length)invalid();ended=true;break;}
    }
    if(!data||!ended)invalid();
  } else if(bytes.length>=16 && bytes[0]===0xff && bytes[1]===0xd8) {
    mime='image/jpeg';let p=2;let scan=false;
    if(bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)invalid();
    while(p+4<=bytes.length){
      if(bytes[p]!==0xff)invalid();while(bytes[p]===0xff)p++;
      const marker=bytes[p++]!;if(p+2>bytes.length)invalid();
      const n=view.getUint16(p);if(n<2||p+n>bytes.length)invalid();
      if(marker===0xe1||marker===0xfe)invalid(); // EXIF/XMP/comment metadata
      if([0xc0,0xc1,0xc2].includes(marker)){if(n<8)invalid();height=view.getUint16(p+3);width=view.getUint16(p+5);}
      if(marker===0xda){scan=true;break;}p+=n;
    }
    if(!scan)invalid();
  } else if(bytes.length>=26 && ascii(0,4)==='RIFF' && ascii(8,4)==='WEBP') {
    mime='image/webp';if(view.getUint32(4,true)+8!==bytes.length)invalid();let p=12;let frame=false;
    while(p+8<=bytes.length){
      const kind=ascii(p,4),n=view.getUint32(p+4,true),start=p+8;if(start+n>bytes.length)invalid();
      if(['EXIF','XMP '].includes(kind))invalid();
      if(kind==='VP8X'){if(n!==10)invalid();width=1+u24(start+4);height=1+u24(start+7);if(width>4096||height>4096||width*height>8_000_000)invalid();}
      if(kind==='VP8 '){if(n<10||ascii(start+3,3)!=='\x9d\x01\x2a')invalid();width=view.getUint16(start+6,true)&0x3fff;height=view.getUint16(start+8,true)&0x3fff;frame=true;}
      if(kind==='VP8L'){if(n<5||bytes[start]!==0x2f)invalid();const bits=view.getUint32(start+1,true);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);frame=true;}
      p=start+n+(n%2);
    }
    if(!frame||p!==bytes.length)invalid();
  } else invalid();
  if(mime!==declaredMime || width<1 || height<1 || width>4096 || height>4096 || width*height>8_000_000)invalid();
  return {mime,extension:mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp',bytes};
}
export function decodePortraitBase64(input:unknown) {
  if(typeof input!=='string' || input.length>Math.ceil(FACE_PHOTO_MAX_BYTES/3)*4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input)) throw new Error('PORTRAIT_BYTES_INVALID');
  try{return Uint8Array.from(atob(input),c=>c.charCodeAt(0));}catch{throw new Error('PORTRAIT_BYTES_INVALID');}
}
