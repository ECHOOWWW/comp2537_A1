
require("./utils.js");



require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const saltRounds = 12;
const port = process.env.PORT || 8080;
const app = express();
const Joi = require("joi");


const expireTime = 1 * 60 * 60 * 1000; 

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var {database} = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');

app.use(express.urlencoded({extended: false}));
app.use("/img", express.static("./public"));


var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
	crypto: {
		secret: mongodb_session_secret
	}
})

app.use(session({ 
    secret: node_session_secret,
	store: mongoStore, //default is memory store 
	saveUninitialized: false, 
	resave: true
}
));

app.get('/', (req,res) => {
  var username = req.query.user;
  if (!req.session.authenticated) {
    res.send(`
      <form action='/signup' method='get' style='margin-block-end: 0'>
        <button type='submit'>Sign up</button>
      </form>
      <form action='/login' method='get'>
        <button type='submit'>Log in</button>
      </form>
    `);
    return;
  } else{
    res.send(`Hello, ${req.session.username}!
    <form action='/members' method='get' style='margin-block-end: 0'> 
      <button type ='submit'>Go to Members Ares</button>
    </form>
    <form action='/logout' method='get'> 
    <button type ='submit'>Logout</button>
  </form>`);
  }
});


app.get('/signup', (req,res) => {
  var html = `
  create user
  <form action='/submitUser' method='post'>
  <input name='username' type='text' placeholder='name'>
  <input name='email' type='email' placeholder='email'>
  <input name='password' type='password' placeholder='password'>
  <button>Submit</button>
  </form>
  `;
  res.send(html);
});

app.post('/submitUser',async(req,res)=>{
  var username = req.body.username;
  var email = req.body.email;
  var password = req.body.password;
  if(!username){
    res.send(`Name is required.<br><a href='/signup'>Try again</a>`);
  }
  if(!email){
    res.send(`Email is required.<br><a href='/signup'>Try again</a>`);
  }
  if(!password){
    res.send(`Password is required.<br><a href='/signup'>Try again</a>`);
  }
  const schema = Joi.object(
		{
			username: Joi.string().alphanum().max(20).required(),
      email: Joi.string().max(30).required(),
			password: Joi.string().max(20).required()
		});
	
	const validationResult = schema.validate({username, email, password});
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/signup");
	   return;
   }

    var hashedPassword = await bcrypt.hash(password, saltRounds);
	
	await userCollection.insertOne({username: username, email: email, password: hashedPassword});
	console.log("Inserted user");

  req.session.authenticated = true;
  req.session.username = username;
  req.session.cookie.maxAge = expireTime;

  res.redirect('/members');
  return;
})

app.get('/login', (req,res) => {
  var html = `
  log in
  <form action='/loggingIn' method='post'>
  <input name='email' type='email' placeholder='email'>
  <input name='password' type='password' placeholder='password'>
  <button>Submit</button>
  </form>
  `;
  res.send(html);
});

app.post('/loggingIn', async (req,res) => {
  var email = req.body.email;
  var password = req.body.password;

const schema = Joi.string().max(30).required();
const validationResult = schema.validate(email);
if (validationResult.error != null) {
   console.log(validationResult.error);
   res.redirect("/login");
   res.send(`Invalid email/password combination. <br><a href='/login'>Try again</a>`);

   return;
}

const result = await userCollection.find({email: email}).project({email: 1, password: 1, username:1, _id: 1}).toArray();

console.log(result);
if (result.length != 1) {
  console.log("user not found");
  res.send(`User not found, please check your email address. <br><a href='/login'>Try again</a>`);
  return;
}
if (await bcrypt.compare(password, result[0].password)) {
  console.log("correct password");
  req.session.authenticated = true;
  req.session.username = result[0].username;
  req.session.cookie.maxAge = expireTime;
  res.redirect('/members');
  return;
}
else {
  console.log("incorrect password");
  res.send(`Incorrect password.<br><a href='/login'>Try again</a>`);
  return;
}
});


app.get('/members', (req,res) => {
  if (!req.session.authenticated) {
    res.redirect('/');
} else {
  const images = ["/img/codingcat1.gif", "/img/codingcat2.gif", "/img/codingcat3.gif"];
  randomIndex = Math.floor(Math.random() * images.length);
  res.send(`<h2>Hello, ${req.session.username}.</h2>
  <img src='${images[randomIndex]}'>
  <form action='/logout' method='get'> 
    <button type ='submit'>Sign out</button>
  </form>`)
}
});


app.get('/logout', (req,res) => {
	req.session.destroy();
  res.redirect('/');
});


app.get('/cat/:id', (req,res) => {

    var cat = req.params.id;

    if (cat == 1) {
        res.send("Fluffy: <img src='/fluffy.gif' style='width:250px;'>");
    }
    else if (cat == 2) {
        res.send("Socks: <img src='/socks.gif' style='width:250px;'>");
    }
    else {
        res.send("Invalid cat id: "+cat);
    }
});


app.use(express.static(__dirname + "/public"));

app.get("*", (req,res) => {
	res.status(404);
	res.send("Page not found - 404");
})

app.listen(port, () => {
	console.log("Node application listening on port "+port);
}); 