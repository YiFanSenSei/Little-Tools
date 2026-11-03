// Small ZIP32 writer using stored entries, with no dependencies or shell commands.
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++) n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(data){let crc=0xffffffff;for(const b of data)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function zip(entries) {
  if(entries.length>65535)throw new Error('Too many entries');
  const local=[],central=[];let offset=0;
  for(const {name,data} of entries){
    if(name.startsWith('/') || name.includes('..') || name.includes('\\'))throw new Error('Unsafe ZIP path');
    const filename=Buffer.from(name), content=Buffer.from(data), crc=crc32(content);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);
    header.writeUInt32LE(crc,14);header.writeUInt32LE(content.length,18);header.writeUInt32LE(content.length,22);header.writeUInt16LE(filename.length,26);
    const directory=Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(33,14);
    directory.writeUInt32LE(crc,16);directory.writeUInt32LE(content.length,20);directory.writeUInt32LE(content.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
    local.push(header,filename,content);central.push(directory,filename);offset+=header.length+filename.length+content.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
