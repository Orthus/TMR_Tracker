const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const r = require('rethinkdb');
var flash = require('connect-flash');
var bcrypt = require('bcrypt-nodejs');
var passport = require('passport');
var local = require('passport-local').Strategy;
const exec = require('child_process').exec;
const args = process.argv;
const config = require('config.json');

var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

//
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(require('express-session')({ secret: 'control_the_move', resave: false, saveUninitialized: false }));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.set('view engine', 'ejs');

// Config

var webport = config.Port;
var address = config.IP_Address;
var connection = null;
r.connect( {host: config.DB_Address, port: config.DB_Port, db: config.DB_Name}, function(err, conn) {
    if (err) throw err;
    connection = conn;
});

app.listen(webport,address, function(){
  console.log('TMR Manager is now listening on ' + webport  + " using db: " + config.DB_Name );
});

var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

passport.use(new local(
  function(username, password, done) {
    console.log(password);
    r.db(config.DB_Name).table('users').filter(r.row('username').eq(username)).run(connection, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }

      user.toArray(function(err, result) {
          if (err) throw err;
          if (result.length == 0) { return done(null, false); }
          console.log(bcrypt.compareSync(password, result[0].password));
          if (!bcrypt.compareSync(password, result[0].password)) { return done(null, false); }
          return done(null, result[0]);
      });
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  r.db(config.DB_Name).table('users').filter(r.row('id').eq(id)).run(connection, function(err, user) {
    if (err) { return done(err); }
    if (!user) { return done(null, false); }
    user.toArray(function(err, result) {
        if (err) throw err;
        return done(null, result[0]);
    });
  });
});




// App Gets
app.get('/favicon.ico', (req, res) => res.status(204));
// welcome page
app.get('/', function (req, res) {
  res.render('index', {authed: req.isAuthenticated(), result: null, error: null});
});
// login
app.get('/login', ensureUnauthenticated, function (req, res) {
  let displayname = AuthCheck().then(data =>{
      res.render('login', {username: displayname, result: null, error: null});
  })
});
app.get('/register', ensureUnauthenticated, function (req, res) {
  res.render('register', {authed: req.isAuthenticated(), result: null, error: null});
});
// submit
app.get('/submit', ensureAuthenticated, function (req, res) {
  res.render('index', {authed: req.isAuthenticated(), result: null, error: null});
});
// search
app.get('/search/', ensureAuthenticated, function (req, res) {
  let list = list_all().then(data => {
    let Filtered_data = filter_array(data);
    res.render('search', {authed: req.isAuthenticated(), username: req.user.username, result: Filtered_data, error: null});
    }).catch(err => {
  });;
});


app.get('/search/:TMR_NUMBER', ensureAuthenticated, function (req, res) {
  let lookup = search(req.params.TMR_NUMBER).then(data => {
  console.log(JSON.parse(data));
  res.render('TMR', {authed: req.isAuthenticated(), result: JSON.parse(data), error: null});
  }).catch(err => {
  });
});

// export
app.get('/export/', ensureAuthenticated, function (req, res) {
  let list = list_all().then(data => {
    let Filtered_data = data;
    let test = toCSV(Filtered_data);
    res.attachment('export.csv');
    res.status(200).send(test);
    }).catch(err => {
  });;
});

// navigation search
app.get('/TMR/', function (req, res) {
  let lookup = search(req.query.TMR_NUMBER).then(data => {
  res.render('TMR', {authed: req.isAuthenticated(), result: JSON.parse(data), error: null});
  }).catch(err => {
  });;
});


// api
app.get('/lookup/:TMR_NUMBER', function (req, res) {
  let lookup = search(req.params.TMR_NUMBER).then(data => {
  res.json(JSON.parse(data));
  }).catch(err => {
  });;
});


app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/login');
});

// APP Posts

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/search');
});
app.post('/register', function (req, res) {
  let newusername = req.body.newusername;
  let newpassword = req.body.newpassword
  console.log(newusername + ": " + newpassword);
  adduser(req.body.newusername, req.body.newpassword);
  res.render('register', {result: null, error: null});
});
app.post('/submit', function (req, res) {
  let tmr_num = req.body.tmr_num;
  let tmr_date = req.body.tmr_date;
  let tmr_status = req.body.tmr_status;
  let req_unit = req.body.req_unit;
  let RequestingDate = req.body.RequestingDate;
  let RequestingUnitPOC = req.body.RequestingUnitPOC;
  let JordanianCellPhone = req.body.JordanianCellPhone;
  let EmailAddress = req.body.EmailAddress;
  let origin = req.body.Location;
  let request_date_time = req.body.DateTime;
  let origin_poc = req.body.OriginName;
  let origin_poc_Cell = req.body.OriginPhone;
  let destination = req.body.Destination;
  let dest_poc = req.body.DestinationName;
  let dest_poc_Cell = req.body.DestinationPhone;
  let Required_Date_Time = req.body.EstimationTimeOfCompletion;
  let ItemDescrption_1 = req.body.ItemDescrption_1;
  let Item_Length_1 = req.body.Length_1;
  let Item_Width_1 = req.body.Width_1;
  let Item_Height_1 = req.body.Height_1;
  let Item_Weight_1 = req.body.Weight_1;
  let ItemDescrption_2 = req.body.ItemDescrption_2;
  let Item_Length_2 = req.body.Length_2;
  let Item_Width_2 = req.body.Width_2;
  let Item_Height_2 = req.body.Height_2;
  let Item_Weight_2 = req.body.Weight_2;
  let ItemDescrption_3 = req.body.ItemDescrption_3;
  let Item_Length_3 = req.body.Length_3;
  let Item_Width_3 = req.body.Width_3;
  let Item_Height_3 = req.body.Height_3;
  let Item_Weight_3 = req.body.Weight_3;
  let ItemDescrption_4 = req.body.ItemDescrption_4;
  let Item_Length_4 = req.body.Length_4;
  let Item_Width_4 = req.body.Width_4;
  let Item_Height_4 = req.body.Height_4;
  let Item_Weight_4 = req.body.Weight_4;
  let ItemDescrption_5 = req.body.ItemDescrption_5;
  let Item_Length_5 = req.body.Length_5;
  let Item_Width_5 = req.body.Width_5;
  let Item_Height_5 = req.body.Height_5;
  let Item_Weight_5 = req.body.Weight_5;
  let ItemDescrption_6 = req.body.ItemDescrption_6;
  let Item_Length_6 = req.body.Length_6;
  let Item_Width_6 = req.body.Width_6;
  let Item_Height_6 = req.body.Height_6;
  let Item_Weight_6 = req.body.Weight_6;
  let ItemDescrption_7 = req.body.ItemDescrption_7;
  let Item_Length_7 = req.body.Length_7;
  let Item_Width_7 = req.body.Width_7;
  let Item_Height_7 = req.body.Height_7;
  let Item_Weight_7 = req.body.Weight_7;
  let ItemDescrption_8 = req.body.ItemDescrption_8;
  let Item_Length_8 = req.body.Length_8;
  let Item_Width_8 = req.body.Width_8;
  let Item_Height_8 = req.body.Height_8;
  let Item_Weight_8 = req.body.Weight_8;
  let PaxNumb = req.body.NumberOfPAX;
  let BagNumb = req.body.NumberofBags;
  let Asset_1 = req.body.Asset_1;
  let Quantity_Asset_1 = req.body.Quantity_1;
  let Asset_2 = req.body.Asset_2;
  let Quantity_Asset_2 = req.body.Quantity_2;
  let Asset_3 = req.body.Asset_3;
  let Quantity_Asset_3 = req.body.Quantity_3;
  let Asset_4 = req.body.Asset_4;
  let Quantity_Asset_4 = req.body.Quantity_4;
  let Asset_5 = req.body.Asset_5;
  let Quantity_Asset_5 = req.body.Quantity_5;
  let IsSens = req.body.SensitiveItems;
  let additional = req.body.AdditionalReference;
  let Higher_Command = req.body.Higher_Command;
  let send = query(tmr_num, tmr_date, Higher_Command, tmr_status, req_unit, RequestingDate, RequestingUnitPOC, JordanianCellPhone, EmailAddress, origin, request_date_time, origin_poc, origin_poc_Cell, destination, dest_poc, dest_poc_Cell,Required_Date_Time, ItemDescrption_1, Item_Length_1, Item_Height_1, Item_Weight_1, ItemDescrption_2, Item_Length_2, Item_Height_2, Item_Weight_2, ItemDescrption_3, Item_Length_3, Item_Height_3, Item_Weight_3, ItemDescrption_4, Item_Length_4, Item_Height_4, Item_Weight_4, ItemDescrption_5, Item_Length_5, Item_Height_5, Item_Weight_5, ItemDescrption_6, Item_Length_6, Item_Height_6, Item_Weight_6, ItemDescrption_7, Item_Length_7, Item_Height_7, Item_Weight_7, ItemDescrption_8, Item_Length_8, Item_Height_8, Item_Weight_8, PaxNumb, BagNumb, Asset_5, Asset_4, Asset_3, Asset_2, Asset_1, Quantity_Asset_5, Quantity_Asset_4, Quantity_Asset_3, Quantity_Asset_2, Quantity_Asset_1, IsSens, additional);
  res.render('index', {result: null, error:null});
});


app.post('/update/:TMR_NUMBER', function (req, res) {
  let Higher_Command = req.body.Higher_Command;
  let tmr_num = req.body.tmr_num;
  let tmr_date = req.body.tmr_date;
  let tmr_status = req.body.tmr_status;
  let req_unit = req.body.req_unit;
  let RequestingDate = req.body.RequestingDate;
  let RequestingUnitPOC = req.body.RequestingUnitPOC;
  let JordanianCellPhone = req.body.JordanianCellPhone;
  let EmailAddress = req.body.EmailAddress;
  let origin = req.body.Location;
  let request_date_time = req.body.DateTime;
  let origin_poc = req.body.OriginName;
  let origin_poc_Cell = req.body.OriginPhone;
  let destination = req.body.Destination;
  let dest_poc = req.body.DestinationName;
  let dest_poc_Cell = req.body.DestinationPhone;
  let Required_Date_Time = req.body.EstimationTimeOfCompletion;
  let ItemDescrption_1 = req.body.ItemDescrption_1;
  let Item_Length_1 = req.body.Length_1;
  let Item_Width_1 = req.body.Width_1;
  let Item_Height_1 = req.body.Height_1;
  let Item_Weight_1 = req.body.Weight_1;
  let ItemDescrption_2 = req.body.ItemDescrption_2;
  let Item_Length_2 = req.body.Length_2;
  let Item_Width_2 = req.body.Width_2;
  let Item_Height_2 = req.body.Height_2;
  let Item_Weight_2 = req.body.Weight_2;
  let ItemDescrption_3 = req.body.ItemDescrption_3;
  let Item_Length_3 = req.body.Length_3;
  let Item_Width_3 = req.body.Width_3;
  let Item_Height_3 = req.body.Height_3;
  let Item_Weight_3 = req.body.Weight_3;
  let ItemDescrption_4 = req.body.ItemDescrption_4;
  let Item_Length_4 = req.body.Length_4;
  let Item_Width_4 = req.body.Width_4;
  let Item_Height_4 = req.body.Height_4;
  let Item_Weight_4 = req.body.Weight_4;
  let ItemDescrption_5 = req.body.ItemDescrption_5;
  let Item_Length_5 = req.body.Length_5;
  let Item_Width_5 = req.body.Width_5;
  let Item_Height_5 = req.body.Height_5;
  let Item_Weight_5 = req.body.Weight_5;
  let ItemDescrption_6 = req.body.ItemDescrption_6;
  let Item_Length_6 = req.body.Length_6;
  let Item_Width_6 = req.body.Width_6;
  let Item_Height_6 = req.body.Height_6;
  let Item_Weight_6 = req.body.Weight_6;
  let ItemDescrption_7 = req.body.ItemDescrption_7;
  let Item_Length_7 = req.body.Length_7;
  let Item_Width_7 = req.body.Width_7;
  let Item_Height_7 = req.body.Height_7;
  let Item_Weight_7 = req.body.Weight_7;
  let ItemDescrption_8 = req.body.ItemDescrption_8;
  let Item_Length_8 = req.body.Length_8;
  let Item_Width_8 = req.body.Width_8;
  let Item_Height_8 = req.body.Height_8;
  let Item_Weight_8 = req.body.Weight_8;
  let PaxNumb = req.body.NumberOfPAX;
  let BagNumb = req.body.NumberofBags;
  let Asset_1 = req.body.Asset_1;
  let Quantity_Asset_1 = req.body.Quantity_1;
  let Asset_2 = req.body.Asset_2;
  let Quantity_Asset_2 = req.body.Quantity_2;
  let Asset_3 = req.body.Asset_3;
  let Quantity_Asset_3 = req.body.Quantity_3;
  let Asset_4 = req.body.Asset_4;
  let Quantity_Asset_4 = req.body.Quantity_4;
  let Asset_5 = req.body.Asset_5;
  let Quantity_Asset_5 = req.body.Quantity_5;
  let IsSens = req.body.SensitiveItems;
  let additional = req.body.AdditionalReference;
  let send = update(tmr_num, tmr_date, tmr_status, Higher_Command, req_unit, RequestingDate, RequestingUnitPOC, JordanianCellPhone, EmailAddress, origin, request_date_time, origin_poc, origin_poc_Cell, destination, dest_poc, dest_poc_Cell,Required_Date_Time, ItemDescrption_1, Item_Length_1, Item_Width_1, Item_Width_2, Item_Width_3, Item_Width_4, Item_Width_5, Item_Width_6, Item_Width_7, Item_Width_8, Item_Height_1, Item_Weight_1, ItemDescrption_2, Item_Length_2, Item_Height_2, Item_Weight_2, ItemDescrption_3, Item_Length_3, Item_Height_3, Item_Weight_3, ItemDescrption_4, Item_Length_4, Item_Height_4, Item_Weight_4, ItemDescrption_5, Item_Length_5, Item_Height_5, Item_Weight_5, ItemDescrption_6, Item_Length_6, Item_Height_6, Item_Weight_6, ItemDescrption_7, Item_Length_7, Item_Height_7, Item_Weight_7, ItemDescrption_8, Item_Length_8, Item_Height_8, Item_Weight_8, PaxNumb, BagNumb, Asset_5, Asset_4, Asset_3, Asset_2, Asset_1, Quantity_Asset_5, Quantity_Asset_4, Quantity_Asset_3, Quantity_Asset_2, Quantity_Asset_1, IsSens, additional);
  res.render('index', {result: null, error:null});
});
// Functions

function query(tmr_num, Higher_Command, tmr_date, tmr_status, req_unit, RequestingDate, RequestingUnitPOC, JordanianCellPhone, EmailAddress, origin, request_date_time, origin_poc, origin_poc_Cell, destination, dest_poc, dest_poc_Cell,Required_Date_Time, ItemDescrption_1, Item_Length_1, Item_Height_1, Item_Weight_1, Item_Width_1, Item_Width_2, Item_Width_3, Item_Width_4, Item_Width_5, Item_Width_6, Item_Width_7, Item_Width_8, ItemDescrption_2, Item_Length_2, Item_Height_2, Item_Weight_2, ItemDescrption_3, Item_Length_3, Item_Height_3, Item_Weight_3, ItemDescrption_4, Item_Length_4, Item_Height_4, Item_Weight_4, ItemDescrption_5, Item_Length_5, Item_Height_5, Item_Weight_5, ItemDescrption_6, Item_Length_6, Item_Height_6, Item_Weight_6, ItemDescrption_7, Item_Length_7, Item_Height_7, Item_Weight_7, ItemDescrption_8, Item_Length_8, Item_Height_8, Item_Weight_8, PaxNumb, BagNumb, Asset_5, Asset_4, Asset_3, Asset_2, Asset_1, Quantity_Asset_5, Quantity_Asset_4, Quantity_Asset_3, Quantity_Asset_2, Quantity_Asset_1, IsSens, additional){
  return new Promise ( (resolve, reject) => {
	  r.table("TMR").insert({
    Higher_Command: Higher_Command,
    id: tmr_num,
    TMR_Number: tmr_num,
    TMR_Date: tmr_date,
    TMR_Status: tmr_status,
    Requesting_Unit: req_unit,
    Requested_Date: RequestingDate,
    Requesting_POC: RequestingUnitPOC,
    POC_Cell: JordanianCellPhone,
    POC_Email: EmailAddress,
    Origin: origin,
    Request_Date: request_date_time,
    Origin_POC: origin_poc,
    Origin_POC_Cell: origin_poc_Cell,
    Destination: destination,
    Destination_POC: dest_poc,
    Destination_POC_Cell: dest_poc_Cell,
    Completion_Date: Required_Date_Time,
    PAX: PaxNumb,
    Bags: BagNumb,
    Sensitive: IsSens,
    More_Details: additional,
    Asset_1: Asset_1,
    Quantity_1: Quantity_Asset_1,
    Asset_2: Asset_2,
    Quantity_2: Quantity_Asset_2,
    Asset_3: Asset_3,
    Quantity_3: Quantity_Asset_3,
    Asset_4: Asset_4,
    Quantity_4: Quantity_Asset_4,
    Asset_5: Asset_5,
    Quantity_5: Quantity_Asset_5,
    Item_1: ItemDescrption_1, 
    Length_1: Item_Length_1,
    Width_1: Item_Width_1,
    Height_1: Item_Height_1, 
    Weight_1: Item_Weight_1,
    Item_2: ItemDescrption_2, 
    Length_2: Item_Length_2,
    Width_2: Item_Width_2, 
    Height_2: Item_Height_2, 
    Weight_2: Item_Weight_2,        
    Item_3: ItemDescrption_3, 
    Length_3: Item_Length_3,
    Width_3: Item_Width_3, 
    Height_3: Item_Height_3, 
    Weight_3: Item_Weight_3,
    Item_4: ItemDescrption_4, 
    Length_4: Item_Length_4,
    Width_3: Item_Width_4, 
    Height_4: Item_Height_4, 
    Weight_4: Item_Weight_4,
    Item_5: ItemDescrption_5, 
    Length_5: Item_Length_5,
    Width_5: Item_Width_5, 
    Height_5: Item_Height_5, 
    Weight_5: Item_Weight_5,
    Item_6: ItemDescrption_6, 
    Length_6: Item_Length_6,
    Width_6: Item_Width_6, 
    Height_6: Item_Height_6, 
    Weight_6: Item_Weight_6,
    Item_7: ItemDescrption_7, 
    Length_7: Item_Length_7,
    Width_7: Item_Width_7, 
    Height_7: Item_Height_7, 
    Weight_7: Item_Weight_7,
    Item_8: ItemDescrption_8, 
    Length_8: Item_Length_8,
    Width_8: Item_Width_8, 
    Height_8: Item_Height_8, 
    Weight_8: Item_Weight_8
}).run(connection, function(err, cursor){
		if (err) {
			return reject(err);
		}
  });
  })};

function search(tmr_num){
  return new Promise ( (resolve, reject) => {
    r.table('TMR').get(tmr_num).run(connection, function(err, cursor) {
    if (err) throw err;
      var lookup = JSON.stringify(cursor, null, 2);
      return resolve(lookup);
    });
})};

function list_all(){
  return new Promise ( (resolve, reject) => {
    r.table('TMR').run(connection, function(err, cursor) {
      var lookup = cursor.toArray();
      return resolve(lookup);
    });    
})};

function filter_array(Listed_Array){
  let newList = Listed_Array.map(list => ({ 
    TMR_Number: list.TMR_Number,
    Requesting_Unit: list.Requesting_Unit,
    TMR_Date: list.TMR_Date,
    Requested_Date: list.Requested_Date,
    }));
  return newList;
}
function toCSV(json) {
  json = Object.values(json);
  var csv = "";
  var keys = (json[0] && Object.keys(json[0])) || [];
  csv += keys.join(',') + '\n';
  for (var line of json) {
    csv += keys.map(key => line[key]).join(',') + '\n';
  }
  return csv;
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  console.log(req.session);
  if (req.method == 'GET') req.session.returnTo = req.originalUrl;
  res.redirect('/');
}

function ensureUnauthenticated(req, res, next) {
  if (!req.isAuthenticated()) return next();
  console.log(req.session);
  if (req.method == 'GET') req.session.returnTo = req.originalUrl;
  res.redirect('/');
}
function AuthCheck(req, res) {
  if (!req.isAuthenticated()){
    var displayname = "null";
    return displayname;
  };
    var displayname = req.user.username;
    return displayname;

}
function adduser(newusername, newpassword) {
  r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
      if (err) throw err;
      connection = conn;
  }).then(res => {
             r.db(config.DB_Name).table('users').insert({
            username: newusername,
            password: bcrypt.hashSync(newpassword),
            roll: 0
          }).run(connection, function(err, res) {
            console.log('Created default user "admin"');
          });
    })
}