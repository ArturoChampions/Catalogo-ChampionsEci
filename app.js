const state={
  products:[],
  query:"",
  family:null,
  subfamily:null,
  capacity:null,
  watchConn:null,
  watchModel:null,
  watchSize:null
};
const $=id=>document.getElementById(id);
const CAPACITY_FAMILIES=["iphone","macbook","imac","ipad","mac mini","mac studio"];
const supportsCapacity=family=>Boolean(family)&&CAPACITY_FAMILIES.some(f=>normalize(family).includes(f));
const isWatchFamily=family=>Boolean(family)&&normalize(family).includes("watch");

const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]+/g," ").trim();

const extractWatchConn=p=>{
  const text=normalize(`${p.name} ${p.details}`);
  if(text.includes("ultra") || text.includes("cellular")) return "GPS + Cellular";
  return "GPS (Wi-Fi)";
};

const extractWatchModel=p=>{
  const text=normalize(`${p.name} ${p.details}`);
  if(text.includes("ultra")) return "Ultra";
  if(/\bse\b/.test(text)) return "SE";
  if(text.includes("series")) return "Series";
  return null;
};

const WATCH_SIZES_BY_MODEL={
  "SE":["40","44"],
  "Series":["42","46"],
  "Ultra":["49"]
};

const extractWatchSize=p=>{
  const text=`${p.name} ${p.details}`;
  const match=text.match(/\b(40|41|42|44|45|46|49)\b/i);
  return match?match[1]:null;
};

const resetWatchFilters=()=>{
  state.watchConn=null;
  state.watchModel=null;
  state.watchSize=null;
};

const imageFor=p=>{
  if(p.image) return p.image;
  const family=normalize(p.family);
  const name=normalize(p.name);

  if(family==="iphone"){
    if(name.includes("18 pro")) return "images/iphone-18-pro-real.png";
    if(name.includes("17 pro")) return "images/iphone-17-pro-real.jpg";
    if(name.includes("air")) return "images/iphone-air-real.png";
    if(name.includes("duo")) return "images/iphone-duo-real.png";
    if(name.includes("17e")) return "images/iphone-17e-real.png";
    return "images/iphone-17-real.png";
  }
  if(family.includes("watch")) return "images/watch-real.jpg";
  if(family.includes("ipad")){
    if(family.includes("pro") || name.includes("pro")) return "images/ipad-pro-real.png";
    if(family.includes("air") || name.includes("air")) return "images/ipad-air-real.png";
    if(family.includes("mini") || name.includes("mini")) return "images/ipad-mini-real.png";
    return "images/ipad-a16-real.png";
  }
  if(family.includes("macbook")){
    if(family.includes("neo") || name.includes("neo")) return "images/macbook-neo-real.jpg";
    if(family.includes("air") || name.includes("air")) return "images/macbook-air-real.jpg";
    return "images/macbook-pro-real.jpg";
  }
  if(family.includes("imac")) return "images/imac-real.jpg";
  if(family.includes("mac studio")) return "images/mac-studio-real.jpg";
  if(family.includes("mac mini")) return "images/mac-mini-real.jpg";
  if(family.includes("pantallas")) return "images/display-real.jpg";

  return "icon.svg";
};

const money=p=>p>0?new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(p):"Sin PVP";
const eanDigits=value=>{const digits=String(value??"").replace(/\D/g,"");return digits.length===12?`0${digits}`:digits.length===13?digits:""};

const barcodeSvg=value=>{
  let digits=String(value??"").replace(/\D/g,"");
  if(digits.length===12)digits=`0${digits}`;
  if(digits.length!==13)return "";
  const left={L:["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"],G:["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"]};
  const right=["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
  const parity=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"][Number(digits.charAt(0))];
  let bits="101";
  for(let i=1;i<=6;i++)bits+=left[parity.charAt(i-1)][Number(digits.charAt(i))];
  bits+="01010";
  for(let i=7;i<=12;i++)bits+=right[Number(digits.charAt(i))];
  bits+="101";
  const quiet=11,module=3,height=82,width=(bits.length+quiet*2)*module;
  const bars=[...bits].map((bit,i)=>bit==="1"?`<rect x="${(quiet+i)*module}" y="0" width="${module}" height="${height}"/>`:"").join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Código de barras EAN ${digits}" xmlns="http://w3.org"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars}</g></svg>`;
};

const formatReference=value=>{const digits=String(value??"").replace(/\D/g,"");if(digits.length===11)return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;return String(value??"")};
const queryTokens=query=>normalize(query).split(" ").filter(Boolean);
const searchable=p=>normalize([p.id,p.name,p.family,p.modelCode,p.status,p.ean,p.details].join(" "));

const extractCapacity=p=>{
  const text=`${p.name} ${p.details}`;
  const tokens=text.match(/\b\d+\s*(?:GB|TB)\b/gi)||[];
  const storage=tokens.map(t=>t.replace(/\s+/g,"").toUpperCase()).filter(label=>{
    if(label.endsWith("TB"))return true;
    const num=parseInt(label,10);
    return num>=64;
  });
  return storage.length?storage.pop():null;
};
function visibleProducts(){
  const tokens=queryTokens(state.query);
  return state.products.filter(p=>{
    const matchesFamily=!state.family||p.family===state.family;
    const matchesCapacity=!state.capacity||extractCapacity(p)===state.capacity;
    const matchesWatchConn=!state.watchConn||extractWatchConn(p)===state.watchConn;
    const matchesWatchModel=!state.watchModel||extractWatchModel(p)===state.watchModel;
    const matchesWatchSize=!state.watchSize||extractWatchSize(p)===state.watchSize;
    return matchesFamily&&matchesCapacity&&matchesWatchConn&&matchesWatchModel&&matchesWatchSize&&tokens.every(t=>searchable(p).includes(t));
  });
}

function renderFilters(){
  const families=[...new Set(state.products.map(p=>p.family))];
  $("filters").innerHTML=families.map(f=>`<button class="filter ${f===state.family?"active":""}" data-family="${f}">${f}</button>`).join("");
  $("filters").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    state.family=state.family===b.dataset.family?null:b.dataset.family;
    if(!supportsCapacity(state.family))state.capacity=null;
    if(!isWatchFamily(state.family))resetWatchFilters();
    renderFilters();
    renderCapacityFilters();
    renderWatchFilters();
    renderProducts();
  });
}

function renderCapacityFilters(){
  const el=$("capacityFilters");
  if(!el)return;
  const show=supportsCapacity(state.family);
  el.classList.toggle("hidden",!show);
  if(!show){
    el.innerHTML="";
    return;
  }
  const order=["64GB","128GB","256GB","512GB","1TB","2TB","4TB","8TB"];
  const familyProducts=state.products.filter(p=>p.family===state.family);
  const caps=[...new Set(familyProducts.map(extractCapacity).filter(Boolean))].sort((a,b)=>{
    const ia=order.indexOf(a),ib=order.indexOf(b);
    return (ia===-1?99:ia)-(ib===-1?99:ib);
  });
  el.innerHTML=caps.map(c=>`<button class="filter ${c===state.capacity?"active":""}" data-cap="${c}">${c}</button>`).join("");
  el.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    state.capacity=state.capacity===b.dataset.cap?null:b.dataset.cap;
    renderCapacityFilters();renderProducts();
  });
}

function renderWatchFilters(){
  const modelEl=$("watchModelFilters");
  const connEl=$("watchConnFilters");
  const sizeEl=$("watchSizeFilters");
  if(!modelEl||!connEl||!sizeEl)return;

  const show=isWatchFamily(state.family);
  modelEl.classList.toggle("hidden",!show);

  if(!show){
    modelEl.innerHTML="";
    connEl.classList.add("hidden");
    connEl.innerHTML="";
    sizeEl.classList.add("hidden");
    sizeEl.innerHTML="";
    return;
  }

  const models=["SE","Series","Ultra"];
  modelEl.innerHTML=models.map(m=>`<button class="filter ${m===state.watchModel?"active":""}" data-model="${m}">${m}</button>`).join("");
  modelEl.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    state.watchModel=state.watchModel===b.dataset.model?null:b.dataset.model;
    state.watchSize=null;

    if(state.watchModel==="Ultra"){
      state.watchConn="GPS + Cellular";
    }else if(!state.watchModel){
      state.watchConn=null;
    }

    renderWatchFilters();
    renderProducts();
  });

  const showSubfilters=Boolean(state.watchModel);
  connEl.classList.toggle("hidden",!showSubfilters);

  if(!showSubfilters){
    connEl.innerHTML="";
  }else{
    const conns=state.watchModel==="Ultra"
      ? ["GPS + Cellular"]
      : ["GPS (Wi-Fi)","GPS + Cellular"];

    connEl.innerHTML=conns.map(c=>`<button class="filter ${c===state.watchConn?"active":""}" data-conn="${c}">${c}</button>`).join("");
    connEl.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      if(state.watchModel==="Ultra")return;
      state.watchConn=state.watchConn===b.dataset.conn?null:b.dataset.conn;
      renderWatchFilters();
      renderProducts();
    });
  }

  const allowedSizes=state.watchModel?(WATCH_SIZES_BY_MODEL[state.watchModel]||[]):[];
  sizeEl.classList.toggle("hidden",allowedSizes.length===0);

  if(allowedSizes.length===0){
    sizeEl.innerHTML="";
  }else{
    sizeEl.innerHTML=allowedSizes.map(s=>`<button class="filter ${s===state.watchSize?"active":""}" data-size="${s}">${s}</button>`).join("");
    sizeEl.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      state.watchSize=state.watchSize===b.dataset.size?null:b.dataset.size;
      renderWatchFilters();
      renderProducts();
    });
  }
}

function renderProducts(){
  const products=visibleProducts();
  $("resultCount").textContent=products.length;
  $("emptyState").classList.toggle("hidden",products.length!==0);
  $("catalog").innerHTML=products.map(p=>`
    <button class="card" data-id="${p.id}">
      <span class="product-icon"><img src="${imageFor(p)}" onerror="this.onerror=null;this.src='icon.svg'" alt=""></span>
      <span><span class="family">${p.family}</span><h2>${p.name}</h2><span class="reference">${formatReference(p.id)}</span></span>
      <span class="card-price">${money(p.price)}<span class="status">${p.status}</span></span>
    </button>`).join("");
  $("catalog").querySelectorAll(".card").forEach(c=>c.onclick=()=>showProduct(state.products.find(p=>p.id===c.dataset.id)));
}

function showProduct(p){
  if(!p)return;
  const img=$("detailImage");
  if(img){
    img.onerror=function(){this.onerror=null;this.src="icon.svg"};
    img.src=imageFor(p);
    img.alt=p.name||"";
  }
  if($("detailFamily")) $("detailFamily").textContent=p.family;
  $("detailName").textContent=p.name;
  $("detailReference").textContent=formatReference(p.id);
  $("detailPrice").textContent=money(p.price);
  const barcode=barcodeSvg(p.ean);
  $("barcodeBlock").classList.toggle("hidden",!barcode);
  $("barcodeUnavailable").classList.toggle("hidden",Boolean(barcode));
  $("barcodeGraphic").innerHTML=barcode;
  $("barcodeNumber").textContent=eanDigits(p.ean);
  $("detailSpecs").innerHTML=[["Modelo",p.modelCode],["EAN",p.ean],["Detalles",p.details]].filter(x=>x).map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("productDialog").showModal();
}

async function start(){
  try{
    const res=await fetch("catalog.json?v="+Date.now());
    state.products=await res.json();
    renderFilters();
    renderCapacityFilters();
    renderWatchFilters();
    renderProducts();
  }catch(e){
    console.error("Error cargando catálogo:",e);
  }
}

$("searchInput").addEventListener("input",e=>{
  state.query=e.target.value;
  $("clearButton").classList.toggle("hidden",!state.query);
  renderProducts();
});
$("clearButton").onclick=()=>{
  $("searchInput").value="";state.query="";state.family=null;state.capacity=null;
  resetWatchFilters();
  $("clearButton").classList.add("hidden");
  renderFilters();renderCapacityFilters();renderWatchFilters();renderProducts();
};
$("closeDialog").onclick=()=>$("productDialog").close();
start();

let codeReader = null;
let scannerControls = null;

function stopScanner() {
  if (scannerControls) {
    scannerControls.stop();
    scannerControls = null;
  }
  const video = $("scannerVideo");
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  if ($("scannerDialog").open) {
    $("scannerDialog").close();
  }
}

function handleScannedCode(rawCode) {
  const cleanCode = String(rawCode || "").trim();
  if (!cleanCode) return;

  stopScanner();

  $("searchInput").value = cleanCode;
  state.query = cleanCode;
  state.family = null;
  state.capacity = null;
  resetWatchFilters();
  $("clearButton").classList.remove("hidden");
  renderFilters();
  renderCapacityFilters();
  renderWatchFilters();
  renderProducts();

  const digits = eanDigits(cleanCode);
  const exactMatch = state.products.find(p => 
    (digits && eanDigits(p.ean) === digits) || 
    normalize(p.id) === normalize(cleanCode)
  );
  if (exactMatch) {
    showProduct(exactMatch);
  }
}

async function startScanner() {
  const dialog = $("scannerDialog");
  const status = $("scannerStatus");
  const video = $("scannerVideo");

  status.textContent = "Iniciando cámara...";
  dialog.showModal();

  try {
    if (window.ZXingBrowser && window.ZXingBrowser.BrowserMultiFormatReader) {
      if (!codeReader) {
        codeReader = new window.ZXingBrowser.BrowserMultiFormatReader();
      }
      status.textContent = "Coloca el EAN dentro del recuadro.";
      scannerControls = await codeReader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        video,
        (result, err) => {
          if (result) {
            handleScannedCode(result.getText());
          }
        }
      );
      return;
    }

    if ("BarcodeDetector" in window) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      video.srcObject = stream;
      await video.play();
      status.textContent = "Coloca el EAN dentro del recuadro.";

      const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "code_128"] });
      const scanLoop = async () => {
        if (!dialog.open) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            handleScannedCode(barcodes.rawValue);
            return;
          }
        } catch (e) {}
        requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
      return;
    }

    status.textContent = "No se encontró el lector de códigos (revisa vendor/zxing-browser.min.js).";
  } catch (error) {
    console.error("Error de cámara:", error);
    status.textContent = "No se pudo acceder a la cámara. Comprueba los permisos y que estés usando HTTPS.";
  }
}

$("scanButton").onclick = startScanner;
$("closeScanner").onclick = stopScanner;
$("scannerDialog").addEventListener("close", stopScanner);
