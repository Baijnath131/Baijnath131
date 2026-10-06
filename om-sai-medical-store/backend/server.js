import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";

const app=express();
const PORT=Number(process.env.PORT||3000);
const SECRET=process.env.JWT_SECRET||"CHANGE_THIS_SECRET";
const db=new Database(path.resolve("data/om-sai.db"));
fs.mkdirSync(path.resolve("uploads"),{recursive:true});
db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,phone TEXT,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,generic_name TEXT,brand TEXT,category_id INTEGER,description TEXT,price REAL NOT NULL,discount REAL DEFAULT 0,stock INTEGER DEFAULT 0,prescription_required INTEGER DEFAULT 0,expiry TEXT,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS prescriptions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,file_name TEXT,stored_name TEXT,status TEXT DEFAULT 'Pending Review',note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,status TEXT DEFAULT 'Pending',subtotal REAL,total REAL,payment_method TEXT DEFAULT 'COD',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,product_id INTEGER,name TEXT,quantity INTEGER,unit_price REAL);
`);
function seed(){
 if(!db.prepare("SELECT 1 FROM users WHERE email=?").get("admin@omsai.local"))db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')").run("Om Sai Admin","admin@omsai.local",bcrypt.hashSync(process.env.ADMIN_PASSWORD||"ChangeMe123!",12));
 if(!db.prepare("SELECT COUNT(*) n FROM categories").get().n)for(const n of ["Pain Relief","Fever & Cold","Vitamins","Digestive Care","First Aid","Personal Care"])db.prepare("INSERT INTO categories(name) VALUES(?)").run(n);
 if(!db.prepare("SELECT COUNT(*) n FROM products").get().n){
  const c=n=>db.prepare("SELECT id FROM categories WHERE name=?").get(n).id;
  const add=db.prepare("INSERT INTO products(name,generic_name,brand,category_id,description,price,discount,stock,prescription_required,expiry) VALUES(?,?,?,?,?,?,?,?,?,?)");
  add.run("Paracetamol 500mg","Paracetamol","Generic",c("Fever & Cold"),"For temporary relief of fever and mild pain.",25,0,100,0,"2027-12-31");
  add.run("ORS Sachet","Oral Rehydration Salts","Generic",c("Digestive Care"),"Oral rehydration product.",20,0,80,0,"2027-10-31");
  add.run("Vitamin C 500mg","Ascorbic Acid","HealthPlus",c("Vitamins"),"Vitamin C supplement.",149,10,50,0,"2027-08-31");
  add.run("Digital Thermometer","Digital Thermometer","DrCare",c("First Aid"),"Digital temperature measurement device.",299,5,25,0,"2029-01-01");
  add.run("Amoxicillin 500mg","Amoxicillin","Example Pharma",c("Pain Relief"),"Prescription medicine example; pharmacist review required.",180,0,20,1,"2027-06-30");
 }
}
seed();

app.use(helmet({contentSecurityPolicy:false}));
app.use(cors());
app.use(express.json({limit:"2mb"}));
app.use(rateLimit({windowMs:15*60*1000,max:300}));
app.use(express.static(path.resolve("frontend")));

function auth(req,res,next){
 const h=req.headers.authorization||"";
 if(!h.startsWith("Bearer "))return res.status(401).json({error:"Login required"});
 try{req.user=jwt.verify(h.slice(7),SECRET);next()}catch{return res.status(401).json({error:"Session expired"})}
}
function staff(req,res,next){return ["admin","pharmacist","staff"].includes(req.user?.role)?next():res.status(403).json({error:"Staff permission required"})}
function publicProduct(p){return {...p,prescription_required:Boolean(p.prescription_required),active:Boolean(p.active)}}

app.get("/api/health",(_,res)=>res.json({ok:true,name:"Om Sai Medical Store"}));
app.post("/api/auth/register",(req,res)=>{
 const {name,email,password,phone=""}=req.body||{};
 if(!name||!email||!password||password.length<8)return res.status(400).json({error:"Name, email and 8+ character password required"});
 try{const r=db.prepare("INSERT INTO users(name,email,password,phone) VALUES(?,?,?,?)").run(name,email.toLowerCase(),bcrypt.hashSync(password,12),phone);
  const u=db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(r.lastInsertRowid);
  res.json({user:u,token:jwt.sign(u,SECRET,{expiresIn:"7d"})});
 }catch{res.status(409).json({error:"Email already registered"})}
});
app.post("/api/auth/login",(req,res)=>{
 const u=db.prepare("SELECT * FROM users WHERE email=?").get((req.body.email||"").toLowerCase());
 if(!u||!bcrypt.compareSync(req.body.password||"",u.password))return res.status(401).json({error:"Invalid email or password"});
 const safe={id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role};
 res.json({user:safe,token:jwt.sign(safe,SECRET,{expiresIn:"7d"})});
});
app.get("/api/auth/me",auth,(req,res)=>res.json({user:db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(req.user.id)}));

app.get("/api/categories",(_,res)=>res.json(db.prepare("SELECT * FROM categories ORDER BY name").all()));
app.get("/api/products",(req,res)=>{
 const {q="",category="",sort="name"}=req.query;const w=["p.active=1"],a=[];
 if(q){w.push("(p.name LIKE ? OR p.generic_name LIKE ? OR p.brand LIKE ?)");a.push("%"+q+"%","%"+q+"%","%"+q+"%")}
 if(category){w.push("p.category_id=?");a.push(category)}
 const order={name:"p.name",price_asc:"p.price",price_desc:"p.price DESC",stock:"p.stock DESC"}[sort]||"p.name";
 const rows=db.prepare(`SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE ${w.join(" AND ")} ORDER BY ${order}`).all(...a).map(publicProduct);
 res.json({products:rows});
});
app.get("/api/products/:id",(req,res)=>{const p=db.prepare("SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?").get(req.params.id);p?res.json({product:publicProduct(p)}):res.status(404).json({error:"Medicine not found"})});

const upload=multer({storage:multer.diskStorage({destination:"uploads",filename:(_,f,cb)=>cb(null,Date.now()+"-"+f.originalname.replace(/[^a-zA-Z0-9._-]/g,"_"))}),limits:{fileSize:5*1024*1024},fileFilter:(_,f,cb)=>cb(null,["image/jpeg","image/png","application/pdf"].includes(f.mimetype))});
app.post("/api/prescriptions",auth,upload.single("prescription"),(req,res)=>{
 if(!req.file)return res.status(400).json({error:"JPG, PNG or PDF prescription required"});
 const r=db.prepare("INSERT INTO prescriptions(user_id,file_name,stored_name) VALUES(?,?,?)").run(req.user.id,req.file.originalname,req.file.filename);
 res.status(201).json({id:r.lastInsertRowid,message:"Prescription submitted for pharmacist review"});
});
app.get("/api/prescriptions/mine",auth,(req,res)=>res.json({prescriptions:db.prepare("SELECT id,file_name,status,note,created_at FROM prescriptions WHERE user_id=? ORDER BY id DESC").all(req.user.id)}));

app.post("/api/orders",auth,(req,res)=>{
 const {items,address,paymentMethod="COD"}=req.body||{};
 if(!Array.isArray(items)||!items.length||!address)return res.status(400).json({error:"Cart and address required"});
 try{
  const result=db.transaction(()=>{
   let subtotal=0,lines=[];
   for(const item of items){
    const p=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(item.productId),qty=Number(item.quantity);
    if(!p||!Number.isInteger(qty)||qty<1||p.stock<qty)throw Error("Invalid product or insufficient stock");
    if(p.expiry&&new Date(p.expiry)<new Date())throw Error(p.name+" is expired");
    if(p.prescription_required&&!req.body.prescriptionId)throw Error(p.name+" requires prescription review");
    const price=Number((p.price*(1-p.discount/100)).toFixed(2));subtotal+=price*qty;lines.push({p,qty,price});
   }
   const total=Number((subtotal+(subtotal<499?40:0)+subtotal*.05).toFixed(2));
   const o=db.prepare("INSERT INTO orders(user_id,subtotal,total,payment_method) VALUES(?,?,?,?)").run(req.user.id,subtotal,total,paymentMethod);
   const oi=db.prepare("INSERT INTO order_items(order_id,product_id,name,quantity,unit_price) VALUES(?,?,?,?,?)");
   for(const x of lines){oi.run(o.lastInsertRowid,x.p.id,x.p.name,x.qty,x.price);db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(x.qty,x.p.id)}
   return o.lastInsertRowid;
  })();
  res.status(201).json({orderId:result});
 }catch(e){res.status(400).json({error:e.message})}
});
app.get("/api/orders/mine",auth,(req,res)=>res.json({orders:db.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC").all(req.user.id)}));
app.get("/api/orders/:id",auth,(req,res)=>{const o=db.prepare("SELECT * FROM orders WHERE id=? AND user_id=?").get(req.params.id,req.user.id);if(!o)return res.status(404).json({error:"Order not found"});o.items=db.prepare("SELECT * FROM order_items WHERE order_id=?").all(o.id);res.json({order:o})});

app.get("/api/admin/summary",auth,staff,(_,res)=>res.json({
 customers:db.prepare("SELECT COUNT(*) n FROM users WHERE role='customer'").get().n,
 products:db.prepare("SELECT COUNT(*) n FROM products WHERE active=1").get().n,
 lowStock:db.prepare("SELECT COUNT(*) n FROM products WHERE active=1 AND stock<=10").get().n,
 orders:db.prepare("SELECT COUNT(*) n FROM orders").get().n,
 revenue:db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status!='Cancelled'").get().n,
 pendingPrescriptions:db.prepare("SELECT COUNT(*) n FROM prescriptions WHERE status='Pending Review'").get().n
}));
app.get("/api/admin/orders",auth,staff,(_,res)=>res.json({orders:db.prepare("SELECT o.*,u.name customer,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC").all()}));
app.patch("/api/admin/orders/:id",auth,staff,(req,res)=>{const allowed=["Pending","Prescription Review","Confirmed","Preparing","Ready","Out for Delivery","Delivered","Cancelled","Refund Requested","Refunded"];if(!allowed.includes(req.body.status))return res.status(400).json({error:"Invalid status"});db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);res.json({ok:true})});
app.get("/api/admin/prescriptions",auth,staff,(_,res)=>res.json({prescriptions:db.prepare("SELECT p.*,u.name customer,u.email FROM prescriptions p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC").all()}));
app.patch("/api/admin/prescriptions/:id",auth,staff,(req,res)=>{if(!["Pending Review","Approved","Rejected"].includes(req.body.status))return res.status(400).json({error:"Invalid status"});db.prepare("UPDATE prescriptions SET status=?,note=? WHERE id=?").run(req.body.status,req.body.note||"",req.params.id);res.json({ok:true})});
app.get("/api/admin/products",auth,staff,(_,res)=>res.json({products:db.prepare("SELECT * FROM products ORDER BY id DESC").all().map(publicProduct)}));
app.post("/api/admin/products",auth,staff,(req,res)=>{const p=req.body;if(!p.name||Number(p.price)<0)return res.status(400).json({error:"Name and valid price required"});const r=db.prepare("INSERT INTO products(name,generic_name,brand,category_id,description,price,discount,stock,prescription_required,expiry) VALUES(?,?,?,?,?,?,?,?,?,?)").run(p.name,p.generic_name||"",p.brand||"",p.category_id||null,p.description||"",p.price,p.discount||0,p.stock||0,p.prescription_required?1:0,p.expiry||"");res.status(201).json({id:r.lastInsertRowid})});
app.patch("/api/admin/products/:id",auth,staff,(req,res)=>{const p=req.body;db.prepare("UPDATE products SET name=?,price=?,discount=?,stock=?,prescription_required=?,active=? WHERE id=?").run(p.name,p.price,p.discount||0,p.stock||0,p.prescription_required?1:0,p.active===false?0:1,req.params.id);res.json({ok:true})});

app.get("*",(req,res)=>res.sendFile(path.resolve("frontend/index.html")));
app.listen(PORT,()=>console.log("Om Sai Medical Store running on port "+PORT));