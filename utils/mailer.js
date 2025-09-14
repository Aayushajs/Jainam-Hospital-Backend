import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({ path: './config/.env' });

if(!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.error("GMAIL_USER or GMAIL_PASS is not set in environment variables.");
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
    auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

console.log("GMAIL_USER:", process.env.GMAIL_USER);
console.log("GMAIL_PASS:", process.env.GMAIL_PASS? '******' : 'Not Set');
console.log("Nodemailer Transporter:", transporter);

export const sendEmail = async (email, otp) =>{
    const mailOptions = {
        from : process.env.GMAIL_USER,
        to : email,
        subject : "Password Reset OTP",
        text : `For your current email ${email}, Your OTP for password reset is ${otp}. It is valid for 10 minutes.`
    }
    console.log("Sending email to:", email);
    console.log("OTP:", otp);
    console.log("Mail Options:", mailOptions);

    return transporter.sendMail(mailOptions, (error, info)=>{
        if(error){
            console.error("Error sending email:", error);
            throw new Error("Email not sent");
        }
        console.log("Email sent successfully:", info.response);
        return "Email sent successfully";
    
    })  
}