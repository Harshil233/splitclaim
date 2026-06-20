const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/splitclaim';

mongoose.connect(MONGODB_URI).then(async () => {
  console.log("Connected to MongoDB!");
  
  const Group = mongoose.model('Group', new mongoose.Schema({}, { strict: false }));
  const Expense = mongoose.model('Expense', new mongoose.Schema({}, { strict: false }));
  
  const groups = await Group.find({});
  console.log("--- GROUPS ---");
  console.log(JSON.stringify(groups, null, 2));
  
  const expenses = await Expense.find({});
  console.log("--- EXPENSES ---");
  console.log(JSON.stringify(expenses, null, 2));
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
