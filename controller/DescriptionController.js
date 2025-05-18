import { Appointment } from "../models/appointmentSchema.js";
import { Description } from "../models/descriptionSchema.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import PDFDocument from 'pdfkit';

export const createDescription = catchAsyncErrors(async (req, res, next) => {
  const {
    appointmentId,
    diagnosis,
    icdCode,
    symptoms,
    medicines,
    testsPrescribed,
    vitalSigns,
    clinicalNotes,
    followUpInstructions,
    nextVisit,
    fee,
    isEmergency
  } = req.body;

  // 1. Verify the appointment exists, belongs to this doctor, and is Accepted
  const appointment = await Appointment.findOne({
    _id: appointmentId,
    doctorId: req.user._id,
    status: "Accepted" // Strictly check for Accepted status
  });

  if (!appointment) {
    return next(new ErrorHandler(
      "Cannot create description - Appointment must be in 'Accepted' status and assigned to you", 
      400
    ));
  }

 
  if (!diagnosis || !medicines || medicines.length === 0) {
    return next(new ErrorHandler(
      "Diagnosis and at least one medicine are required",
      400
    ));
  }

  // 3. Create description
  const description = await Description.create({
    patientId: appointment.patientId,
    doctorId: req.user._id,
    appointmentId,
    diagnosis,
    icdCode,
    symptoms: symptoms || [],
    medicines,
    testsPrescribed: testsPrescribed || [],
    vitalSigns: vitalSigns || {},
    clinicalNotes,
    followUpInstructions,
    nextVisit,
    fee: {
      consultationFee: fee?.consultationFee || 0,
      medicationFee: fee?.medicationFee || 0,
      totalFee: (fee?.consultationFee || 0) + (fee?.medicationFee || 0)
    },
    isEmergency: isEmergency || false
  });


  appointment.status = "Completed";
  await appointment.save();

  res.status(201).json({
    success: true,
    message: "Medical description created successfully",
    description,
    updatedAppointment: {
      id: appointment._id,
      newStatus: appointment.status
    }
  });
});

// Get  descriptions only for a patient
export const getPatientDescriptions = catchAsyncErrors(async (req, res, next) => {
  const { patientId } = req.params;
  
  const descriptions = await Description.find({ patientId })
    .populate('doctorId', 'firstName lastName email phone doctorDepartment')
    .populate('appointmentId', 'appointment_date status department') // Added appointment details
    .sort({ date: -1 });


  const response = descriptions.map(desc => ({
    _id: desc._id,
    diagnosis: desc.diagnosis,
    date: desc.date,
    doctor: {
      _id: desc.doctorId._id,
      name: `${desc.doctorId.firstName} ${desc.doctorId.lastName}`,
      department: desc.doctorId.doctorDepartment,
      contact: {
        email: desc.doctorId.email,
        phone: desc.doctorId.phone
      }
    },
    appointment: desc.appointmentId ? {
      _id: desc.appointmentId._id,
      date: desc.appointmentId.appointment_date,
      status: desc.appointmentId.status,
      department: desc.appointmentId.department
    } : null,
    medicines: desc.medicines,
    nextVisit: desc.nextVisit
  }));

  res.status(200).json({
    success: true,
    count: descriptions.length,
    descriptions: response
  });
});

// Get all descriptions for a doctor
export const getDescription = catchAsyncErrors(async (req, res, next) => {
  const description = await Description.findOne({
    doctorId: req.user._id // Ensure the description belongs to the requesting doctor
  })
  .populate('patientId', 'firstName lastName nic dob gender')
  .populate('doctorId', 'firstName lastName email phone doctorDepartment address');

  if (!description) {
    return next(new ErrorHandler("Description not found or unauthorized access", 404));
  }

  res.status(200).json({
    success: true,
    description
  });
});

// for admin
export const getDescriptionsByFilters = catchAsyncErrors(async (req, res, next) => {
  const { patientId, doctorId, date, diagnosis, icdCode, isEmergency } = req.query;
  
  const filter = {};
  if (patientId) filter.patientId = patientId;
  if (doctorId) filter.doctorId = doctorId;
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    filter.date = { $gte: startDate, $lte: endDate };
  }
  if (diagnosis) filter.diagnosis = { $regex: diagnosis, $options: 'i' };
  if (icdCode) filter.icdCode = icdCode;
  if (isEmergency) filter.isEmergency = isEmergency === 'true';

  const descriptions = await Description.find(filter)
    .sort({ date: -1 })
    .populate('patientId', 'firstName lastName')
    .populate('doctorId', 'firstName lastName doctorDepartment');

  res.status(200).json({
    success: true,
    count: descriptions.length,
    descriptions
  });
});


export const generateDescriptionPDF = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  
  const description = await Description.findById(id)
    .populate('patientId', 'firstName lastName nic dob gender bloodGroup')
    .populate('doctorId', 'firstName lastName email phone doctorDepartment licenseNumber')
    .populate('appointmentId', 'appointment_date');

  // PDF Setup
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true
  });

  // ====== COLOR THEME ======
  const colors = {
    primary: '#1a73e8',
    secondary: '#34a853',
    accent: '#fbbc05',
    dark: '#202124',
    light: '#f8f9fa',
    border: '#dadce0'
  };

  // ====== HEADER SECTION ======
  // Logo Column (Left)
  doc.image('public/logo1.png', 50, 10, {
    width: 120,
    height: 120,
    align: 'left'

  });

  // Header Column (Right)
  doc.fillColor(colors.primary)
     .fontSize(18)
     .text('MEDICAL PRESCRIPTION', 400, 45, { align: 'right' });
  
  doc.fillColor(colors.dark)
     .fontSize(10)
     .text('24/7 Emergency: 0112-3456789 | info@hospital.com', 400, 90, { align: 'right',  });

  doc.moveDown(1);

  // ====== PATIENT INFORMATION (2 COLUMNS) ======
  doc.fillColor(colors.primary)
     .fontSize(14)
     .text('PATIENT INFORMATION', 50, 120);
  
  // Left Column
  doc.fillColor(colors.dark)
     .fontSize(11)
     .text(`Name: ${description.patientId.firstName} ${description.patientId.lastName}`, 50, 150)
     .text(`Gender/Age: ${description.patientId.gender} | ${calculateAge(description.patientId.dob)} yrs`, 50, 170)
     .text(`Blood Group: ${description.patientId.bloodGroup}`, 50, 190);

  // Right Column
  doc.text(`NIC: ${description.patientId.nic}`, 300, 150)
     .text(`DOB: ${new Date(description.patientId.dob).toLocaleDateString()}`, 300, 170)
     .text(`Appointment: ${new Date(description.appointmentId.appointment_date).toLocaleString()}`, 300, 190);

  // Divider
  doc.moveTo(50, 210).lineTo(550, 210).stroke(colors.border);

  // ====== MEDICAL DETAILS (2 COLUMNS) ======
  doc.fillColor(colors.primary)
     .fontSize(14)
     .text('CLINICAL FINDINGS', 50, 230);

  // Left Column - Diagnosis
  doc.fillColor(colors.dark)
     .fontSize(11)
     .text('Diagnosis:', 50, 260, { underline: false })
     .text(description.diagnosis, 50, 280, { width: 250 });

  // Right Column - Symptoms
  doc.fillColor("#000000", 300, 260)
     .text('Symptoms:', 300, 260, { underline: false, })
     .text(description.symptoms.join(', '), 300, 280, { width: 250 });

  // ====== VITAL SIGNS TABLE ======
  doc.fillColor(colors.primary)
     .fontSize(14)
     .text('VITAL SIGNS', 50, 330);

  // Table Header
  const vitalHeaderY = 350;
  ['Parameter', 'Value', 'Status'].forEach((text, i) => {
    doc.fillColor('#ffffff')
       .rect(50 + (i * 150), vitalHeaderY, 150, 20)
       .fill(colors.primary);
    doc.fillColor('#ffffff')
       .fontSize(10)
       .text(text, 55 + (i * 150), vitalHeaderY + 5);
  });

  // Table Rows
  const vitals = [
    { param: 'Blood Pressure', value: description.vitalSigns?.bloodPressure || '--', normal: '120/80' },
    { param: 'Pulse Rate', value: description.vitalSigns?.pulse || '--', normal: '60-100 bpm' },
    { param: 'Temperature', value: description.vitalSigns?.temperature || '--', normal: '98.6°F' },
    { param: 'SpO2', value: description.vitalSigns?.oxygenSaturation || '--', normal: '>95%' },
    { param: 'BMI', value: description.vitalSigns?.bmi || '--', normal: '18.5-24.9' }
  ];

  vitals.forEach((vital, i) => {
    const y = vitalHeaderY + 25 + (i * 20);
    const rowColor = i % 2 === 0 ? colors.light : '#ffffff';
    
    doc.fillColor(rowColor)
       .rect(50, y, 500, 20)
       .fill();
    
    doc.fillColor(colors.dark)
       .fontSize(9)
       .text(vital.param, 55, y + 5)
       .text(vital.value, 205, y + 5)
       .text(vital.normal, 355, y + 5);
  });

  // ====== PRESCRIPTION (3 COLUMNS) ======
  doc.fillColor(colors.primary)
     .fontSize(14)
     .text('PRESCRIPTION', 50, 500);

  // Table Header
  const medHeaderY = 520;
  ['Medicine', 'Dosage', 'Instructions'].forEach((text, i) => {
    doc.fillColor('#ffffff')
       .rect(50 + (i * 170), medHeaderY, 170, 20)
       .fill(colors.secondary);
    doc.fillColor('#ffffff')
       .fontSize(10)
       .text(text, 55 + (i * 170), medHeaderY + 5);
  });

  // Table Rows
  description.medicines.forEach((med, i) => {
    const y = medHeaderY + 25 + (i * 20);
    const rowColor = i % 2 === 0 ? colors.light : '#ffffff';
    
    doc.fillColor(rowColor)
       .rect(50, y, 500, 20)
       .fill();
    
    doc.fillColor(colors.dark)
       .fontSize(9)
       .text(med.name, 55, y + 5)
       .text(med.dosage, 205, y + 5)
       .text(`${med.frequency} for ${med.duration}`, 355, y + 5);
  });

  // ====== FOOTER ======
  doc.fillColor(colors.primary)
     .fontSize(12)
     .text('Doctor\'s Signature:', 50, 650);
  
  // Signature Image with transparent background
  try {
    doc.image('public/Dr_S.png', 50, 670, {
      width: 100,
      height: 50,
    });
  } catch {
    doc.fillColor(colors.dark)
       .text('_________________________', 50, 680);
  }

  // Doctor Details (Right)
  doc.fillColor(colors.dark)
     .fontSize(10)
     .text(`Dr. ${description.doctorId.firstName} ${description.doctorId.lastName}`, 400, 650)
     .text(`License: ${description.doctorId.licenseNumber}`, 400, 670)
     .text(`Department: ${description.doctorId.doctorDepartment}`, 400, 690);

  // Finalize
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Prescription_${id}.pdf`);
  doc.pipe(res);
  doc.end();
});

// Age Calculator
function calculateAge(dob) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}

 // Update description
export const updateDescription = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

 
  const existingDescription = await Description.findById(id);
  if (!existingDescription) {
    return next(new ErrorHandler("Description not found", 404));
  }

 
  if (existingDescription.doctorId.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("Unauthorized to update this description", 403));
  }

 
  const updatedData = {
    ...updates,
    lastModified: Date.now()  
  };


  const description = await Description.findByIdAndUpdate(
    id,
    updatedData,
    {
      new: true, 
      runValidators: true  
    }
  )
  .populate('patientId', 'firstName lastName')
  .populate('doctorId', 'firstName lastName');

  res.status(200).json({
    success: true,
    message: "Description updated successfully",
    description,
    modificationTime: description.lastModified  
  });
});