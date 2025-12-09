#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/promote_admin.js correo@ejemplo.com');
  process.exit(1);
}

async function run(){
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/maketplaceDB';
  await mongoose.connect(uri, { useNewUrlParser:true, useUnifiedTopology:true });
  const user = await User.findOne({ email });
  if (!user) {
    console.error('Usuario no encontrado:', email);
    await mongoose.disconnect();
    process.exit(2);
  }
  user.role = 'admin';
  user.isActive = true;
  await user.save();
  console.log('Usuario promovido a admin:', email);
  await mongoose.disconnect();
}

run().catch(err=>{ console.error(err); process.exit(1); });
