import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Message } from "../models/messageSchema.js";
import {redis} from "../config/redis.js"

export const sendMessage = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, phone, message } = req.body;
  if (!firstName || !lastName || !email || !phone || !message) {
    return next(new ErrorHandler("Please Fill Full Form!", 400));
  }
  await Message.create({ firstName, lastName, email, phone, message });
  res.status(200).json({
    success: true,
    message: "Message Sent!",
  });
});

// get all messages with pagination
// export const getAllMessages = catchAsyncErrors(async (req, res, next) => {
//   const { page = 1, limit = 10 } = req.query; // Default pagination values

//   const redisKey = `messages:page:${page}:limit:${limit}`;

//   const cachedData = await redis.get(redisKey);
//   if (cachedData) {
//     return res.status(200).json({
//       success: true,
//       cached: true,
//       ...JSON.parse(cachedData)
//     })
//   }


//   const [messages, totalCount] = await Promise.all([
//     Message.find()
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(Number(limit)),
//     Message.countDocuments()
//   ]);

//   const responseData = {
//     count: messages.length, 
//     totalCount,            
//     totalPages: Math.ceil(totalCount / limit),
//     currentPage: Number(page),
//     messages,
//   }

//   await redis.setEx(redisKey, 3600, JSON.stringify(responseData));


//   res.status(200).json({
//     success: true,
//     cached: false,
//     ...responseData
//   });
// });


export const getAllMessages = catchAsyncErrors(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query; // Default pagination values

  const redisKey = `messages:page:${page}:limit:${limit}`;

  const cachedData = await redis.get(redisKey);
  if (cachedData) { 
    return res.status(200).json({
      success: true,
      cached: true,
      ...JSON.parse(cachedData)
    })
  }

  const [messages, totalCount] = await Promise.all([
    Message.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Message.countDocuments()
  ]);

  const responseData = {
    count: messages.length, 
    totalCount,            
    totalPages: Math.ceil(totalCount / limit),
    currentPage: Number(page),
    messages,
  }

  await redis.setEx(redisKey, 3600, JSON.stringify(responseData));



  res.status(200).json({
    success: true,
    cached: false,
    ...responseData,
  });
});


// export const getAllMessages = catchAsyncErrors(async (req, res, next) => {
//   const { page = 1, limit = 10 } = req.query; // Default pagination values

//   const [messages, totalCount] = await Promise.all([
//     Message.find()
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(Number(limit)),
//     Message.countDocuments()
//   ]);

//   res.status(200).json({
//     success: true,
//     count: messages.length, 
//     totalCount,            
//     totalPages: Math.ceil(totalCount / limit),
//     currentPage: Number(page),
//     messages,
//   });
// });



export const DeleteMessage = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const message = await Message.findOne({
    _id: id,
  });

  if (!message) {
    return next(new ErrorHandler("Message not found or unauthorized", 404));
  }

  const deletionResult = await Message.deleteOne({ _id: id });

  if (deletionResult.deletedCount === 0) {
    return next(new ErrorHandler("Message could not be deleted", 500));
  }
  res.status(200).json({
    success: true,
    message: "Message deleted successfully",
    data: {
      id,
      deletedAt: new Date()
    }
  });
});
// get message and send notification 
export const getMessage = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const message = await Message.findById(id);
  if (!message) {
    return next(new ErrorHandler("Message Not Found!", 404));
  }
  res.status(200).json({
    success: true,
    message: "Message Found!",
    messageData: message,
  });
  const adminEmail = process.env.ADMIN_EMAIL;
  const subject = "New Message from " + message.firstName;
  const text = `You have a new message from ${message.firstName} ${message.lastName}.\n\nEmail: ${message.email}\nPhone: ${message.phone}\nMessage: ${message.message}`;
  await sendEmail(adminEmail, subject, text);
  res.status(200).json({
    success: true,
    message: "Message Found!",
    messageData: message,
  });
});
