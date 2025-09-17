import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { generateToken } from "../utils/jwtToken.js";
import cloudinary from "cloudinary";
import mongoose from "mongoose";
import { Appointment } from "../models/appointmentSchema.js";
import LoginHistory from "../models/loginHistorySchema.js";

// Get login history (admin only) with pagination and filters
export const getLoginHistory = catchAsyncErrors(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const { role, action, userId, startDate, endDate } = req.query;

  // validate userId if provided
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    return next(new ErrorHandler("Invalid userId", 400));
  }

  const filter = {};
  if (role) {
    filter.role = role;
  } // Admin or Doctor
  if (action) {
    filter.action = action;
  } // login or logout
  if (userId) {
    filter.userId = userId;
  }
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      filter.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.timestamp.$lte = new Date(endDate);
    }
  }

  const [total, items] = await Promise.all([
    LoginHistory.countDocuments(filter),
    LoginHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "userId", select: "firstName lastName email role" }),
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
export const getLoginHistoryByUserId = catchAsyncErrors(
  async (req, res, next) => {
    const { id } = req.params;

    // validate id format first to avoid Mongoose CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorHandler("Invalid user id", 400));
    }
    // Authorization: Admin can view any, Doctor can view only their own
    if (req.user.role === "Doctor" && req.user._id.toString() !== id) {
      return next(
        new ErrorHandler(
          "Unauthorized: doctors can only access their own history",
          403
        )
      );
    }

    const user = await User.findById(id).select(
      "firstName lastName email role doctorDepartment docAvatar"
    );
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // latest 10
    const latest = await LoginHistory.find({ userId: id })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate({
        path: "userId",
        select: "firstName lastName email role doctorDepartment docAvatar",
      });

    // all (paginated)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;
    const total = await LoginHistory.countDocuments({ userId: id });
    const all = await LoginHistory.find({ userId: id })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "userId",
        select: "firstName lastName email role doctorDepartment docAvatar",
      });

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
  }
);

// Get login history for the currently authenticated admin/doctor
// Returns latest 10 and paginated all entries for the logged-in user
export const getMyLoginHistory = catchAsyncErrors(async (req, res, next) => {
  // req.user is set by isAdminOrDoctorAuthenticated middleware
  const userId = req.user && req.user._id;
  if (!userId) {
    return next(new ErrorHandler("Authenticated user not found", 401));
  }

  // Optional date/time filtering from request body
  // Accepts ISO 8601 strings for any of: startDate, endDate, startTime, endTime
  // Priority: if startTime/endTime provided, use them; otherwise use startDate/endDate.
  const { startDate, endDate, startTime, endTime } = req.body || {};
  const timestampFilter = {};

  const tryParseDate = (val) => {
    if (!val) {
      return null;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // prefer time-based filters if present
  const parsedStartTime = tryParseDate(startTime);
  const parsedEndTime = tryParseDate(endTime);
  if (startTime || endTime) {
    if (startTime && !parsedStartTime) {
      return next(new ErrorHandler("Invalid startTime format. Use ISO 8601.", 400));
    }
    if (endTime && !parsedEndTime) {
      return next(new ErrorHandler("Invalid endTime format. Use ISO 8601.", 400));
    }
    if (parsedStartTime) {
      timestampFilter.$gte = parsedStartTime;
    }
    if (parsedEndTime) {
      timestampFilter.$lte = parsedEndTime;
    }
  } else {
    const parsedStartDate = tryParseDate(startDate);
    const parsedEndDate = tryParseDate(endDate);
    if (startDate && !parsedStartDate) {
      return next(new ErrorHandler("Invalid startDate format. Use ISO 8601.", 400));
    }
    if (endDate && !parsedEndDate) {
      return next(new ErrorHandler("Invalid endDate format. Use ISO 8601.", 400));
    }
    if (parsedStartDate) {
      timestampFilter.$gte = parsedStartDate;
    }
    if (parsedEndDate) {
      timestampFilter.$lte = parsedEndDate;
    }
  }

  const baseFilter = { userId };
  if (Object.keys(timestampFilter).length) {
    baseFilter.timestamp = timestampFilter;
  }

  // latest 10 (apply same filter)
  const latest = await LoginHistory.find(baseFilter)
    .sort({ timestamp: -1 })
    .limit(10)
    .populate({
      path: "userId",
      select: "firstName lastName email role doctorDepartment docAvatar",
    });

  // all (paginated)
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500); // cap to 500
  const skip = (page - 1) * limit;

  const total = await LoginHistory.countDocuments(baseFilter);
  const all = await LoginHistory.find(baseFilter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "userId",
      select: "firstName lastName email role doctorDepartment docAvatar",
    });

  res.status(200).json({
    success: true,
    user: {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role,
      doctorDepartment: req.user.doctorDepartment,
      docAvatar: req.user.docAvatar,
    },
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

  if (!email || !password || !confirmPassword || !role) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }

  if (password !== confirmPassword) {
    return next(
      new ErrorHandler("Password & Confirm Password Do Not Match!", 400)
    );
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
export const getPatientsWithAppointments = catchAsyncErrors(
  async (req, res, next) => {
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
              $in: await Appointment.distinct("patientId", {
                doctorId: doctorId,
              }),
            },
          },
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
                      { $eq: ["$doctorId", doctorId] },
                    ],
                  },
                },
              },
            ],
            as: "appointmentsWithDoctor",
          },
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
        { $limit: limit },
      ];

      // Get both paginated results and total count
      const [patients, totalCount] = await Promise.all([
        User.aggregate(aggregationPipeline),
        User.countDocuments({
          role: "Patient",
          _id: {
            $in: await Appointment.distinct("patientId", {
              doctorId: doctorId,
            }),
          },
        }),
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
      return next(
        new ErrorHandler("Error fetching patients with appointments", 500)
      );
    }
  }
);

// delete doctor
export const deleteDoctor = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  // Find the doctor and check if they were created by the current admin
  const doctor = await User.findOne({
    _id: id,
    role: "Doctor",
    createdBy: req.user._id, // Only find doctors created by this admin
  });

  if (!doctor) {
    return next(
      new ErrorHandler(
        "Doctor not found or you don't have permission to delete this doctor",
        404
      )
    );
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
      _id: { $ne: req.user._id }, // Exclude the current admin
    });

    if (emailExists) {
      return next(
        new ErrorHandler("Email is already registered by another user!", 400)
      );
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
      _id: { $ne: req.user._id }, // Exclude the current patient
    });

    if (emailExists) {
      return next(
        new ErrorHandler("Email is already registered by another user!", 400)
      );
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
      _id: { $ne: req.user._id }, // Exclude the current doctor
    });

    if (emailExists) {
      return next(
        new ErrorHandler("Email is already registered by another user!", 400)
      );
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
