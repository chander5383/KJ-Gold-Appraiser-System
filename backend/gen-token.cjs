require('dotenv').config();
const { generateToken } = require('./src/middleware/auth');
const u = {id:'ac977dc6-a145-49da-8e59-8ad2574db39b',username:'admin',role:'admin',full_name:'Administrator'};
require('fs').writeFileSync('E:/KJ Test/.token', generateToken(u));
require('fs').writeFileSync('E:/KJ Test/.user', JSON.stringify(u));
console.log('ok');
