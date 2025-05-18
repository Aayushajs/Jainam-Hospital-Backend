import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true }, // e.g., "Twice daily"
  duration: { type: String, required: true }, // e.g., "7 days"
  instructions: String, // "After meals"
  type: { type: String, enum: ["Tablet", "Syrup", "Injection", "Capsule"] }
});

const vitalSignsSchema = new mongoose.Schema({
  bloodPressure: String, // "120/80 mmHg"
  pulse: Number, // 72
  temperature: Number, // 98.6
  oxygenSaturation: Number, // 98
  height: Number, // in cm
  weight: Number, // in kg
  bmi: Number
});

const descriptionSchema = new mongoose.Schema({
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment"
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
  diagnosis: {
    type: String,
    required: true
  },
  icdCode: { // International Classification of Diseases code
    type: String,
    uppercase: true
  },
  symptoms: [String],
  medicines: [medicineSchema],
  testsPrescribed: [{
    name: String,
    instructions: String
  }],
  vitalSigns: vitalSignsSchema,
  clinicalNotes: String,
  followUpInstructions: String,
  nextVisit: Date,
  fee: {
    consultationFee: Number,
    medicationFee: Number,
    totalFee: Number
  },
  paymentStatus: {
    type: String,
    enum: ["Paid", "Unpaid", "Partially Paid"],
    default: "Unpaid"
  },
  signature: { // Doctor's digital signature
    type: String
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  lastModified: Date,

}, { timestamps: true });

export const Description = mongoose.model("Description", descriptionSchema);