// Run lengths keep the original cell identities and thin connections in playback.
export function encode(labels){
  const bytes=[];
  for(let i=0;i<labels.length;){
    let end=i+1;
    while(end<labels.length && labels[end]===labels[i])end++;
    const length=end-i;
    bytes.push(labels[i],length&255,length>>>8);
    i=end;
  }
  return btoa(String.fromCharCode(...bytes));
}
export function decode(raster,size){
  const string=atob(raster),labels=new Uint8Array(size);
  let first=0;
  for(let i=0;i<string.length;i+=3){
    const length=string.charCodeAt(i+1)+(string.charCodeAt(i+2)<<8);
    labels.fill(string.charCodeAt(i),first,first+length);
    first+=length;
  }
  return labels;
}
