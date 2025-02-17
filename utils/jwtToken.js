export const generateToken = (user, message, statusCode, res) => {
  const token = user.generateJsonWebToken();
  // Determine the cookie name based on the user's role
  const cookieName = user.role === 'Admin' ? 'adminToken' : 'patientToken';

  res
    .status(statusCode)
    .cookie(cookieName, token, {
      expires: new Date(
        Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
      ),
      httpOnly: true, // Set httpOnly to true to prevent XSS attacks
      sameSite: 'None', // Set sameSite to None to allow third-party cookies
      secure: true,  // Set secure to true if using HTTPS
    })
    .json({
      success: true,
      message,
      user,
      token,
    });
};

