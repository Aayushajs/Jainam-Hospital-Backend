import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { generateToken } from "../utils/jwtToken.js";
import cloudinary from "cloudinary";
import { Appointment } from "../models/appointmentSchema.js";

// petient section
export const patientRegister = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, nic, dob, gender, password } =
    req.body;
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phone ||
    !nic ||
    !dob ||
    !gender ||
    !password
  ) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }

  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(new ErrorHandler("User already Registered!", 400));
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    role: "Patient",
  });
  generateToken(user, "User Registered!", 200, res);
});


export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password, confirmPassword, role } = req.body;


  if (!email || !password || !confirmPassword || !role) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }

 
  if (password !== confirmPassword) {
    return next(new ErrorHandler("Password & Confirm Password Do Not Match!", 400));
  }

  
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid Email Or Password!", 400));
  }

  
  if (role !== user.role) {
    return next(new ErrorHandler(`User Not Found With This Role!`, 400));
  }

  
  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    return next(new ErrorHandler("Invalid Email Or Password!", 400));
  }

  generateToken(user, "Login Successfully!", 201, res);
});


// addmin section
export const addNewAdmin = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, nic, dob, gender, password } =
    req.body;
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phone ||
    !nic ||
    !dob ||
    !gender ||
    !password
  ) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }

  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(new ErrorHandler("Admin With This Email Already Exists!", 400));
  }

  const admin = await User.create({
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    role: "Admin",
  });
  res.status(200).json({
    success: true,
    message: "New Admin Registered",
    admin,
  });
});

// add new doctor
export const addNewDoctor = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Doctor Avatar Required!", 400));
  }
  const { docAvatar } = req.files;
  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedFormats.includes(docAvatar.mimetype)) {
    return next(new ErrorHandler("File Format Not Supported!", 400));
  }
  const {
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    doctorDepartment,
  } = req.body;
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phone ||
    !nic ||
    !dob ||
    !gender ||
    !password ||
    !doctorDepartment ||
    !docAvatar
  ) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }
  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(
      new ErrorHandler("Doctor With This Email Already Exists!", 400)
    );
  }
  const cloudinaryResponse = await cloudinary.uploader.upload(
    docAvatar.tempFilePath
  );
  if (!cloudinaryResponse || cloudinaryResponse.error) {
    console.error(
      "Cloudinary Error:",
      cloudinaryResponse.error || "Unknown Cloudinary error"
    );
    return next(
      new ErrorHandler("Failed To Upload Doctor Avatar To Cloudinary", 500)
    );
  }
  const doctor = await User.create({
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    password,
    role: "Doctor",
    doctorDepartment,
    createdBy: req.user._id,
    docAvatar: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
  });
  res.status(200).json({
    success: true,
    message: "New Doctor Registered",
    doctor,
  });
});
// get all doctors
export const getAllDoctors = catchAsyncErrors(async (req, res, next) => {
  const doctors = await User.aggregate([
    { $match: { role: "Doctor" } },

    {
      $lookup: {
        from: "appointments",
        localField: "_id",
        foreignField: "doctorId",
        as: "appointments",
      },
    },

    {
      $addFields: {
        totalAppointments: { $size: "$appointments" },
        acceptedCount: {
          $size: {
            $filter: {
              input: "$appointments",
              as: "appt",
              cond: { $eq: ["$$appt.status", "Accepted"] },
            },
          },
        },
        rejectedCount: {
          $size: {
            $filter: {
              input: "$appointments",
              as: "appt",
              cond: { $eq: ["$$appt.status", "Rejected"] },
            },
          },
        },
        pendingCount: {
          $size: {
            $filter: {
              input: "$appointments",
              as: "appt",
              cond: { $eq: ["$$appt.status", "Pending"] },
            },
          },
        },
      },
    },

    {
      $project: {
        password: 0,
        __v: 0,
        appointments: 0,
      },
    },

    { $sort: { totalAppointments: -1 } },
  ]);

  res.status(200).json({
    success: true,
    doctors,
  });
});

// get all doctors for admin
export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

// Logout function for dashboard admin
export const logoutAdmin = catchAsyncErrors(async (req, res, next) => {
  res
    .status(201)
    .cookie("adminToken", "", {
      httpOnly: true,
      expires: new Date(Date.now()),
      sameSite: "None",
      secure: true,
    })
    .json({
      success: true,
      message: "Admin Logged Out Successfully.",
    });
});

// Logout function for frontend patient
export const logoutPatient = catchAsyncErrors(async (req, res, next) => {
  res
    .status(201)
    .cookie("patientToken", "", {
      httpOnly: true,
      expires: new Date(Date.now()),
      secure: true,
      sameSite: "None",
    })
    .json({
      success: true,
      message: "Patient Logged Out Successfully.",
    });
});

// doctor logout
export const logoutDoctor = catchAsyncErrors(async (req, res, next) => {
  res
    .status(201)
    .cookie("doctorToken", "", {
      httpOnly: true,
      expires: new Date(Date.now()),
      secure: true,
      sameSite: "None",
    })
    .json({
      success: true,
      message: "Doctor Logged Out Successfully.",
    });
});

// get all rgistered patients
export const getAllPatients = catchAsyncErrors(async (req, res, next) => {
  try {
    // Get all patients and their appointment counts in a single query using aggregation
    const patientsWithCount = await User.aggregate([
      {
        $match: { role: "Patient" },
      },
      {
        $lookup: {
          from: "appointments",
          localField: "_id",
          foreignField: "patientId",
          as: "appointments",
        },
      },
      {
        $addFields: {
          appointmentCount: { $size: "$appointments" },
        },
      },
      {
        $project: {
          password: 0,
          __v: 0,
          appointments: 0, // Remove the appointments array after counting
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: patientsWithCount.length,
      patients: patientsWithCount,
    });
  } catch (error) {
    return next(new ErrorHandler("Error fetching patients", 500));
  }
});

// get patient details by only dr.
export const getPatientsWithAppointments = catchAsyncErrors(async (req, res, next) => {
  try {
    const doctorId = req.user._id; // Assuming the doctor is logged in and their ID is in req.user
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get patients who have appointments with this doctor
    const aggregationPipeline = [
      {
        $match: { 
          role: "Patient",
          // Only patients who have appointments with this doctor
          _id: { 
            $in: await Appointment.distinct("patientId", { doctorId: doctorId }) 
          }
        }
      },
      {
        $lookup: {
          from: "appointments",
          let: { patientId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$patientId", "$$patientId"] },
                    { $eq: ["$doctorId", doctorId] }
                  ]
                }
              }
            }
          ],
          as: "appointmentsWithDoctor"
        }
      },
      {
        $addFields: {
          appointmentCount: { $size: "$appointmentsWithDoctor" },
        },
      },
      {
        $project: {
          password: 0,
          __v: 0,
          appointmentsWithDoctor: 0, // Remove the appointments array after counting
        },
      },
      { $skip: skip },
      { $limit: limit }
    ];

    // Get both paginated results and total count
    const [patients, totalCount] = await Promise.all([
      User.aggregate(aggregationPipeline),
      User.countDocuments({ 
        role: "Patient",
        _id: { $in: await Appointment.distinct("patientId", { doctorId: doctorId }) }
      })
    ]);

    res.status(200).json({
      success: true,
      count: patients.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      patients,
    });
  } catch (error) {
    return next(new ErrorHandler("Error fetching patients with appointments", 500));
  }
});


// delete doctor
export const deleteDoctor = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  // Find the doctor and check if they were created by the current admin
  const doctor = await User.findOne({
    _id: id,
    role: "Doctor",
    createdBy: req.user._id  // Only find doctors created by this admin
  });

  if (!doctor) {
    return next(new ErrorHandler("Doctor not found or you don't have permission to delete this doctor", 404));
  }

  // Delete the doctor
  await User.deleteOne({ _id: id });

  // Delete all appointments associated with this doctor
  await Appointment.deleteMany({ doctorId: id });

  res.status(200).json({
    success: true,
    message: "Doctor deleted successfully",
    data: {
      id: id,
      deletedAt: new Date(),
    },
  });
});

// get all admins
export const getAllAdmins = catchAsyncErrors(async (req, res, next) => {
  const admins = await User.aggregate([
    { $match: { role: "Admin" } },

    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "createdBy",
        as: "doctorsCreated",
      },
    },
    {
      $addFields: {
        doctorsCreatedCount: { $size: "$doctorsCreated" },
      },
    },
    {
      $project: {
        password: 0,
        __v: 0,
        doctorsCreated: 0,
      },
    },
    // Sort by doctor count (descending)
    { $sort: { doctorsCreatedCount: -1 } },
  ]);

  res.status(200).json({
    success: true,
    admins,
  });
});

// upadate profile
export const updateAdminProfile = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, nic, dob, gender } = req.body;

  const admin = await User.findById(req.user._id);
  if (!admin || admin.role !== "Admin") {
    return next(new ErrorHandler("Admin not found!", 404));
  }
if (email && email !== admin.email) {
    const emailExists = await User.findOne({ 
      email: email,
      _id: { $ne: req.user._id } // Exclude the current admin
    });
    
    if (emailExists) {
      return next(new ErrorHandler("Email is already registered by another user!", 400));
    }
  }

  admin.firstName = firstName || admin.firstName;
  admin.lastName = lastName || admin.lastName;
  admin.email = email || admin.email;
  admin.phone = phone || admin.phone;
  admin.nic = nic || admin.nic;
  admin.dob = dob || admin.dob;
  admin.gender = gender || admin.gender;


  await admin.save();

  res.status(200).json({
    success: true,
    message: "Admin profile updated successfully!",
    admin,
  });
});

export const updatePatientProfile = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, nic, dob, gender } = req.body;

  const patient = await User.findById(req.user._id);
  if (!patient || patient.role !== "Patient") {
    return next(new ErrorHandler("Patient not found!", 404));
  }
    if (email && email !== patient.email) {
    const emailExists = await User.findOne({ 
      email: email,
      _id: { $ne: req.user._id } // Exclude the current patient
    });
    
    if (emailExists) {
      return next(new ErrorHandler("Email is already registered by another user!", 400));
    }
  }

  patient.firstName = firstName || patient.firstName;
  patient.lastName = lastName || patient.lastName;
  patient.email = email || patient.email;
  patient.phone = phone || patient.phone;
  patient.nic = nic || patient.nic;
  patient.dob = dob || patient.dob;
  patient.gender = gender || patient.gender;

  await patient.save();

  res.status(200).json({
    success: true,
    message: "Patient profile updated successfully!",
    patient,
  });
});

export const updateDoctorProfile = catchAsyncErrors(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    doctorDepartment,
  } = req.body;

  const doctor = await User.findById(req.user._id);
  if (!doctor || doctor.role !== "Doctor") {
    return next(new ErrorHandler("Doctor not found!", 404));
  }

    if (email && email !== doctor.email) {
    const emailExists = await User.findOne({ 
      email: email,
      _id: { $ne: req.user._id } // Exclude the current doctor
    });
    
    if (emailExists) {
      return next(new ErrorHandler("Email is already registered by another user!", 400));
    }
  }

  if (req.files && req.files.docAvatar) {
    const docAvatar = req.files.docAvatar;
    const allowedFormats = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedFormats.includes(docAvatar.mimetype)) {
      return next(new ErrorHandler("File format not supported!", 400));
    }

    if (doctor.docAvatar?.public_id) {
      await cloudinary.uploader.destroy(doctor.docAvatar.public_id);
    }

    const cloudinaryResponse = await cloudinary.uploader.upload(
      docAvatar.tempFilePath
    );
    doctor.docAvatar = {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    };
  }

  doctor.firstName = firstName || doctor.firstName;
  doctor.lastName = lastName || doctor.lastName;
  doctor.email = email || doctor.email;
  doctor.phone = phone || doctor.phone;
  doctor.nic = nic || doctor.nic;
  doctor.dob = dob || doctor.dob;
  doctor.gender = gender || doctor.gender;
  doctor.doctorDepartment = doctorDepartment || doctor.doctorDepartment;

  await doctor.save();

  res.status(200).json({
    success: true,
    message: "Doctor profile updated successfully!",
    doctor,
  });
});
