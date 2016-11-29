const fs = require('fs');
const readline = require('readline');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const dotenv = require('dotenv');

dotenv.load();

const CALENDAR_ID = process.env.CALENDAR_ID;

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'reserver-it.json';

fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }

  authorize(JSON.parse(content), (auth) => { setInterval(main, 1000, auth); });
});

function authorize(credentials, callback) {
  const clientSecret = credentials.installed.client_secret;
  const clientId = credentials.installed.client_id;
  const redirectUrl = credentials.installed.redirect_uris[0];
  const auth = new googleAuth();
  const oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

function getNewToken(oauth2Client, callback) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

function isBusy(auth, cb) {
  const calendar = google.calendar('v3');

  const timeMin = (new Date());
  timeMin.setHours(timeMin.getHours());
  
  calendar.events.list({
    auth: auth,
    calendarId: CALENDAR_ID,
    timeMin: timeMin.toISOString(),
    maxResults: 1,
    singleEvents: true,
    orderBy: 'startTime'
  }, function (err, response) {
    if (err) {
      return cb(err);
    }
    const events = response.items;
    if (events.length === 0) {
      return cb(null, false);
    } else {
      const event = events[0];
      if (event.start.date) {
        return cb(null, true);
      }
      
      if (new Date(event.start.dateTime).getTime() < timeMin.getTime()) {
        return cb(null, true);
      }
      else {
        return cb(null, false);
      }
    }
  });
}

function main(auth) {
  isBusy(auth, (err, busy) => {
    if (err) {
      return console.log('The API returned an error: ' + err);
    }
    
    if (busy) {
      console.log('Busy');
    }
    else {
      console.log('Available');
    }
  });
};