import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { generateToken } from "../utils/jwtToken.js";
import cloudinary from "cloudinary";
import { Appointment } from "../models/appointmentSchema.js";
import LoginHistory from "../models/loginHistorySchema.js";
import { generateOTP } from "../utils/otp.js";
import { redis } from "../config/redis.js";
import { sendEmail } from "../utils/mailer.js";

// Get login history (admin only) with pagination and filters
export const getLoginHistory = catchAsyncErrors(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const { role, action, userId, startDate, endDate } = req.query;

  const filter = {};
  if (role) { filter.role = role; } // Admin or Doctor
  if (action) { filter.action = action; } // login or logout
  if (userId) { filter.userId = userId; }
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) { filter.timestamp.$gte = new Date(startDate); }
    if (endDate) { filter.timestamp.$lte = new Date(endDate); }
  }

  const [total, items] = await Promise.all([
    LoginHistory.countDocuments(filter),
    LoginHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'userId', select: 'firstName lastName email role' }),
  ]);

  res.status(200).json({
    success: true,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    items,
  });
});

// Get login history for a single user id
// Response contains two arrays:
// - latest: latest 10 loginHistory entries
// - all: paginated full loginHistory entries for that user
export const getLoginHistoryByUserId = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  // Authorization: Admin can view any, Doctor can view only their own
  if (req.user.role === "Doctor" && req.user._id.toString() !== id) {
    return next(new ErrorHandler("Unauthorized: doctors can only access their own history", 403));
  }

  const user = await User.findById(id).select("firstName lastName email role doctorDepartment docAvatar");
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // latest 10
  const latest = await LoginHistory.find({ userId: id })
    .sort({ timestamp: -1 })
    .limit(10)
    .populate({ path: 'userId', select: 'firstName lastName email role doctorDepartment docAvatar' });

  // all (paginated)
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 100;
  const skip = (page - 1) * limit;
  const total = await LoginHistory.countDocuments({ userId: id });
  const all = await LoginHistory.find({ userId: id })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: 'userId', select: 'firstName lastName email role doctorDepartment docAvatar' });

  res.status(200).json({
    success: true,
    user,
    latest,
    all,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

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

  console.log("Login attempt:", { email, role, passwordProvided: !!password, confirmPasswordProvided: !!confirmPassword });
  console.log("Request Body:", req.body);


  if (!email || !password || !confirmPassword || !role) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }


  if (password !== confirmPassword) {
    return next(new ErrorHandler("Password & Confirm Password Do Not Match!", 400));
  }


  const user = await User.findOne({ email }).select("+password");
  console.log("User found:", user); 

  if (!user) {
    return next(new ErrorHandler("Invalid Email Or Password!", 400));
  }


  if (role !== user.role) {
    return next(new ErrorHandler(`User Not Found With This Role!`, 400));
  }


  const isPasswordMatch = await user.comparePassword(password);
  console.log("Password match:", isPasswordMatch);
  if (!isPasswordMatch) {
    return next(new ErrorHandler("Invalid Email Or Password!", 400));
  }

  // Record login event for Admin / Doctor before issuing token
  if (user.role === "Admin" || user.role === "Doctor") {
    try {
      await LoginHistory.create({
        userId: user._id,
        role: user.role,
        action: "login",
        timestamp: new Date(),
      });
    } catch (err) {
      // non-fatal: log and continue
      console.error("Failed to record login history:", err);
    }
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
  const { user } = req;
  res.status(200).json({
    success: true,
    user,
  });
});

// Logout function for dashboard admin
export const logoutAdmin = catchAsyncErrors(async (req, res, next) => {
  // Record logout event (best-effort)
  if (req.user && req.user.role === "Admin") {
    try {
      await LoginHistory.create({
        userId: req.user._id,
        role: "Admin",
        action: "logout",
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Failed to record logout history:", err);
    }
  }

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
  // Record logout event (best-effort)
  if (req.user && req.user.role === "Doctor") {
    try {
      await LoginHistory.create({
        userId: req.user._id,
        role: "Doctor",
        action: "logout",
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Failed to record logout history:", err);
    }
  }

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
    const { docAvatar } = req.files;
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



// ----------------------- yaha se aaryan ne kiya hai -----------------------
// ----------------------- FROM hERE Code is done by AARYAN -----------------------
// ----------------------- यहाँ से कोड आर्यन द्वारा किया गया है। -----------------------



export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    console.log("Received forgot password request for:", { email, phone });

    if (!email && !phone) {
      return next(new ErrorHandler("Please Provide Email or Phone!", 400));
    }

    const userExists = email
      ? await User.findOne({ email })
      : await User.findOne({ phone });

    console.log("User found:", userExists);
    if (!userExists) {
      return next(new ErrorHandler("User Not Found!", 404));
    }

    const otp = generateOTP();
    console.log("Generated OTP:", otp); 
    await redis.set(`otp:${userExists._id}`, otp, 'EX', 600);
    if (email) {
      console.log("Sending OTP to email:", email);
      await sendEmail(email, otp);
    }

    res.status(200).json({
      success: true,
      message: "OTP Sent Successfully!",
    });

  } catch (error) {
    return next(new ErrorHandler("Error occurred while processing request", 500));
  }
})

export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  try {
    const userId = req.user._id;
    console.log("User ID from auth middleware:", userId);

    const { otp, inputPassword } = req.body;

    if (!userId || !otp) {
      return next(new ErrorHandler("Please Provide UserId & OTP!", 400));
    }

    const savedOTP = await redis.get(`otp:${userId}`);

    if (!savedOTP) {
      console.log("No OTP found or OTP expired for userId:", userId); 
      return next(new ErrorHandler("OTP Expired! Please Try Again.", 400));
    }

    if (savedOTP !== otp) {
      return next(new ErrorHandler("Invalid OTP!", 400));
    }

    const user = await User.findById(userId);
    console.log("User found for password reset:", user); 

    if (!user) {
      return next(new ErrorHandler("User Not Found!", 404));
    }

    const newPassword = inputPassword ;
    console.log("New Password:", newPassword); 

    // const salt = await bcrypt.genSalt(10);
    // const hashedNewPassword = await bcrypt.hash(newPassword, salt);
    // console.log("Hashed New Password:", hashedNewPassword); 

    // user.password = hashedNewPassword;
    user.password = newPassword;
    await user.save();

    console.log("Password Reset Successfully!");  
    await redis.del(`otp:${userId}`);

    res.status(200).json({
      success: true,
      message: "Password Reset Successfully!",
    });

  } catch (error) {
    console.error("Error occurred while resetting password:", error);
    return next(new ErrorHandler("Error occurred while processing request", 500));
  }
})