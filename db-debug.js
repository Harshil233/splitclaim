const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://harshilrathod233_db_user:daaVhkCZKLyCe9pq@splitclaim-cluster.dffenr8.mongodb.net/splitclaim?retryWrites=true&w=majority&appName=splitclaim-cluster';

mongoose.connect(MONGODB_URI).then(async () => {
  console.log("Connected to MongoDB Atlas!");
  
  const Group = mongoose.model('Group', new mongoose.Schema({}, { strict: false }));
  const Expense = mongoose.model('Expense', new mongoose.Schema({}, { strict: false }));
  
  const group = await Group.findOne({ name: "checking" });
  console.log("--- GROUP checking ---");
  console.log(JSON.stringify(group, null, 2));
  
  const expenses = await Expense.find({ groupId: group._id });
  console.log("--- EXPENSES for checking ---");
  console.log(JSON.stringify(expenses, null, 2));
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
