
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGODB_URI;

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');



// MongoDB user model(s)
const User = require('../models/User');
const UserVerification = require('../models/UserVerification');
const { Class, Grade } = require('../models/UserData');


//email handler
const nodemailer = require("nodemailer");

//unique string
const {v4: uuidv4} = require("uuid");

//env variables
require("dotenv").config();

// Password Handler
const bcrypt = require('bcrypt');

// Path for static verified page
const path = require("path");

//nodemailer staff
const transporter = nodemailer.createTransport({
    host: 'mailslurp.mx',
    port: '2587',
    secure: false,
    auth: {
        user: 'mxxmrWBP3LhRZXjN5Z8lsOCzldz8gX11',
        pass: 'FScfsYEG286OUrPSYWypmVhvF6SJQBXT',
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS,
    }   
})

//testing seccess
transporter.verify((error, success) => {
    if(error) {
        console.log(error);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
})

// Signup
router.post('/signup', (req, res) => {
    let { name, email, password } = req.body;

    name = name.trim();
    email = email.trim();
    password = password.trim();

    if (name === "" || email === "" || password === "") {
        res.json({
            status: "FAILED",
            message: "Empty input fields!"
        });
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]{3,18}$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid username entered. Must be between 3-18 characters"
        });
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "Invalid email entered"
        });
    } else if (password.length < 8) {
        res.json({
            status: "FAILED",
            message: "Password is too short!"
        });
    } else {
        // Checking if user already exists
        User.find({ email }).then(result => {
            if (result.length) {
                // A user already exists
                res.json({
                    status: "FAILED",
                    message: "User with the provided email already exists"
                });
            } else {
                // Try to create new user
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        verified: false,
                        classfmt: 1,
                        gradefmt: 1,
                        settingfmt: 1
                    });

                    newUser.save().then(result => {
                        //handle account verification
                        sendVerificationEmail(result, res);
                    })
                    .catch(err => {
                        console.error("Error saving user:", err);
                        res.json({
                            status: "FAILED",
                            message: "An error occurred while saving user account!"
                        });
                    });
                });
            }
        }).catch(err => {
            console.error("Error checking existing user:", err);
            res.json({
                status: "FAILED",
                message: "An error occurred while checking for the existing user!"
            });
        });
    }
});

// send verification email
const sendVerificationEmail = ({_id, email}, res) => {
    // url to be used in the email
    const currentUrl = "https://www.omnigrader.com/";

    const uniqueString = uuidv4() + _id;

    // mail options
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify Your Email",
        html: `<p>Verify your email address to complete the signup and login to your account.</p><p>This link
        <b>expires in 6 hours</b>.</p><p>Press <a href=${
            currentUrl + "user/verify/" + _id + "/" + uniqueString
        }>here</a> to proceed.</p>`,
    };

    // hash the uniqueString
    const saltRounds = 10;
    bcrypt
      .hash(uniqueString, saltRounds)
      .then((hashedUniqueString) => {
        // set values in userVerification collection
        const newVerification = new UserVerification({
            userId: _id,
            uniqueString: hashedUniqueString,
            createdAt: Date.now(),
            expiresAt: Date.now() + 21600000,
        });

        newVerification
          .save()
          .then(() => {
            transporter
              .sendMail(mailOptions)
              .then(() => {
                //email sent and verification record saved
                res.json({
                    status: "PENDING",
                    message: "verification email sent. Please allow 5 minutes for the email to send."
                });
              })
              .catch((error) => {
                console.log(error);
                res.json({
                    status: "FAILED",
                    message: "verification email failed"
                });
            })
          })
          .catch((error) => {
            console.log(error);
            res.json({
                status: "FAILED",
                message: "Couldn't save verification email data!"
            });
          })
      })
      .catch(() => {
        res.json({
            status: "FAILED",
            message: "An error occured while hashing email data!"
        });
      })
};

// send password reset email TEMPLATE
const sendEmail = async (options) => {
    const mailOption = {
        from: process.env.AUTH_EMAIL,
        to: options.email,
        subject: options.subject,
        text: options.message,
        // html: "<p>HTML version of the message</p>" // Optionally include HTML body
    };

    try {
        const info = await transporter.sendMail(mailOption);
        console.log("Message sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("sendEmail error:", error);
        return false;
    }
};


// verify email
router.get("/verify/:userId/:uniqueString", (req, res) => {
    let {userId, uniqueString} = req.params;

    UserVerification.find({userId})
      .then((result) => {
        if (result.length > 0) {
            // user verification record exists so we proceed

            const {expiresAt} = result[0];
            const hashedUniqueString = result[0].uniqueString;

            // checking for expired unique string
            if (expiresAt < Date.now()) {
                // record has expired so we delete it
                UserVerification
                  .deleteOne({userId})
                  .then(result => {
                    User.deleteOne({_id: userId})
                      .then(() => {
                        let message = "Link has expired. Please sign up again";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                      })
                      .catch(error => {
                        let message = "Clearing user with expired unique string failed.";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                      })
                  })
                  .catch((error) => {
                    console.log(error);
                    let message = "An error occured while clearing expired user verification record";
                    res.redirect(`/user/verified/error=true&message=${message}`);
                  })
            } else {
                // valid record exists so we validate the user string
                // First conpare the hashed unique string

                bcrypt
                  .compare(uniqueString, hashedUniqueString)
                  .then(result => {
                    if (result) {
                        // strings match
                        User.updateOne({_id: userId}, {verified: true})
                          .then(() => {
                            UserVerification
                              .deleteOne({userId})
                              .then(() => {
                                res.sendFile(path.join(__dirname, "./../../public/verified.html"));
                              })
                          .catch(error => {
                                console.log(error);
                                let message = "An error occured while finalizing successful verification.";
                                res.redirect(`/user/verified?error=true&message=${encodeURIComponent(message)}`);
                              })
                            })
                          .catch(error => {
                              console.log(error);
                              let message = "An error occured while updating user record to show verified.";
                              res.redirect(`/user/verified?error=true&message=${encodeURIComponent(message)}`);
                        });

                    } else {
                        // existing record but incorrect verification details passed.
                        let message = "Invalid verification details passed. Check your inbox.";
                        res.redirect(`/user/verified?error=true&message=${encodeURIComponent(message)}`);
                    }
                  })
                  .catch(error => {
                    let message = "An error occured while comparing the unique strings.";
                    res.redirect(`/user/verified?error=true&message=${encodeURIComponent(message)}`);
                  })
            }
        } else {
            // user verification record doesn't exist
            let message = "Account record doesn't exist or has been verified already. Please sign up or log in.";
            res.redirect(`/user/verified?error=true&message=${encodeURIComponent(message)}`);
        }
      })
      .catch((error) => {
        console.log(error);
        let message = "An error occured while checking for existing user verification record";
        res.redirect(`/user/verified?error=true&message=${encodeURIComponent(message)}`);
    })
});

// Verified page route
router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'public', 'verified.html'));
});
router.get("/resetPassword/:token", (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'public', 'resetPassword.html'));
});
// Route to serve grader.html with class ID as a parameter
router.get("/grader/:classId", (req, res) => {
    res.sendFile(path.join(__dirname, '../..', 'public', 'grader.html'));
});

// Signin
router.post('/signin', async (req, res) => {
    let { email, password } = req.body;
    email = email.trim();
    password = password.trim();

    if (email === "" || password === "") {
        res.json({
            status: "FAILED",
            message: "Empty credential supplied"
        });
    } else {
        try {
            const user = await User.findOne({ email });
            if (!user) {
                return res.json({
                    status: "FAILED",
                    message: "No matching user found!"
                });
            }

            if (!user.verified) {
                return res.json({
                    status: "FAILED",
                    message: "Email hasn't been verified yet. Check your inbox.",
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                // Set session cookie
                req.session.user = {
                    id: user._id.toString(),
                    name: user.name
                };

                // Explicitly save the session before sending the response
                req.session.save(err => {
                    if(err) {
                        console.error("Session save error:", err);
                        return res.json({
                            status: "FAILED",
                            message: "An error occurred while saving the session"
                        });
                    }

                    // Only send the response once the session has been saved
                    res.json({
                        status: "SUCCESS",
                        message: "Sign-in successful"
                    });
                });
                //console.log("Logged in user:", req.session);
            } else {
                return res.json({
                    status: "FAILED",
                    message: "Invalid password entered!"
                });
            }
        } catch (err) {
            console.error("Error during sign-in:", err);
            res.json({
                status: "FAILED",
                message: "An error occurred while checking for existing user"
            });
        }
    }
});


// logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ status: "FAILED", message: "Logout failed due to server error" });
        }
        res.clearCookie('connect.sid'); // Adjust the cookie name if you are not using the default name
        res.json({ status: "SUCCESS", message: "Logged out successfully" });
    });
});

// check login state and return user
router.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({
            status: "SUCCESS",
            message: "it worked",
            user: {
                name: req.session.user.name,
                id: req.session.user.id.toString() // Include the user ID in the response
            }
        });
    } else {
        // No user in session
        res.json({ 
            status: "FAILED",
            message: req.session,
        });
    }
    // This is the secret you've set in express-session
    const secret = process.env.AUTH_PASSWORD; 
});

// checks if user is logged in (for copy/paste)
router.get('/some-protected-route', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

    // User is logged in, proceed with the route logic
});




// Password reset email
router.post('/forgotPassword', async (req, res) => {
    // get user based on posted email
    const user = await User.findOne({email: req.body.email});

    if(!user){
        res.json({
            status: "FAILED",
            message: "We could not find the user with the given email"
        });
    }

    // generate random reset token
    const resetToken = user.createResetPasswordToken();
    await user.save({validateBeforeSave: false});

    //send email to user with reset token
    const resetUrl = `${req.protocol}://${req.get('host')}/user/resetPassword/${resetToken}`;
    const message = `We have recieved a password reset request. Please use the below link to reset your password\n\n${resetUrl}\n\nThis reset password link will be valid for 1 hour.`

    try{
        await sendEmail({
            email: user.email,
            subject: 'Password change request recieved',
            message: message
        });

        res.json({
            status:'PENDING',
            message: 'password reset link will be sent to the user email within 5 minutes.'
        })
    }catch(err){

        res.json({
            status: "FAILED",
            message: "An error occurred while sending password reset email. Please try again later"
        });
        
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
        user.save({validateBeforeSave: false});
    }
    
});

router.patch('/resetPassword/:token', async (req, res) => {
    //check of the usere exists with the given token and has not expired
    const token = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({passwordResetToken: token, passwordResetTokenExpires: {$gt: Date.now()}});

    if(!user){
        res.json({
            status: "FAILED",
            message: "Token is invalid or has expired"
        });
    } else if(req.body.password === req.body.confirmPassword) {
        // resetting the user password
        const saltRounds = 10;
        hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        user.password = hashedPassword;
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
        await user.save();
        res.json({
            status: "SUCCESS",
            message: "Password is reset. Please proceed to log in."
        });
    } else {
        res.json({
            status: "FAILED",
            message: "Passwords do not match. Please try again."
        });
    }

});

// all user in class management !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


// POST endpoint to create a new class, linked to a user
router.post('/api/createClass', async (req, res) => {
    const { class_name, total_grade, credit_amount, userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ status: "FAILED", message: "Invalid user ID" });
    }

    const newClass = new Class({
        class_name: 'Untitled',
        total_grade,
        credit_amount: 3,
        userId, // Linking the class directly to a user via userId
    });

    try {
        await newClass.save();

        // Create a new Grade document linked to the created class
        const newGrade = new Grade({
            class: newClass._id,
            grade_type: 3,
            decimal_places: 2,
            letter_grades: [ 97, 94, 90, 87, 84, 80, 77, 74, 70, 67, 64, 60 ]
        });

        // Save the new grade
        await newGrade.save();

        // Link the newly created class to the User document
        await User.findByIdAndUpdate(userId, { $push: { classes: newClass._id } });

        res.status(201).json({ 
            status: "SUCCESS", 
            message: "Class created successfully", 
            _id: newClass._id,
            class_name: newClass.class_name,
            total_grade: newClass.total_grade,
            credit_amount: newClass.credit_amount,
        });
        //console.log(newClass);
    } catch (error) {
        console.error("Failed to create class:", error);
        res.status(500).json({ status: "FAILED", message: "Failed to create class" });
    }
});

// POST endpoint to update a class profile
router.post('/api/updateProfile', async (req, res) => {

    const { class_id, class_name, credit_amount } = req.body;

    Class.findOneAndUpdate(
        { _id: class_id }, // filter by class_id
        { class_name, credit_amount }, // fields to update
        { new: true, runValidators: true } // options
    ).then(updatedClass => {
    if (!updatedClass) {
        return res.status(404).json({ status: "FAILED", message: "Class not found" });
    }
    res.json({ 
        status: "SUCCESS", 
        message: "Class updated successfully", 
        updatedClass 
    });
    }).catch(error => {
        console.error("Error updating class profile:", error);
        res.status(500).json({ status: "FAILED", message: "Failed to update class profile" });
    });

});

// DELETE endpoint to remove a class profile
router.delete('/api/deleteClass/:classId', async (req, res) => {
    const { classId } = req.params;

    try {
        // First, find and delete the class by its custom class_id
        const deletedClass = await Class.findOneAndDelete({ _id: classId });
        if (!deletedClass) {
            return res.status(404).json({ status: "FAILED", message: "Class not found" });
        }

        // Find all grades associated with the deleted class ID and delete them
        await Grade.deleteMany({ class: deletedClass._id });
        await User.findByIdAndUpdate(deletedClass.userId, { $pull: { classes: deletedClass._id } });

        res.json({ status: "SUCCESS", message: "Class deleted successfully" });
    } catch (error) {
        console.error("Failed to delete class:", error);
        res.status(500).json({ status: "FAILED", message: "Failed to delete class" });
    }
});


// GET endpoint to fetch all classes for a specific user
router.get('/api/getClasses', async (req, res) => {
    const userId = req.session.user && req.session.user.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ status: "FAILED", message: "Invalid or missing user ID" });
    }

    try {
        const classes = await Class.find({ userId });
        res.json({ status: "SUCCESS", classes });
    } catch (error) {
        console.error("Failed to fetch classes:", error);
        res.status(500).json({ status: "FAILED", message: "Failed to fetch classes" });
    }
});



// grader routes !!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// Route to get the Grade document for a specific class and user
router.get('/api/grades/:userId/:classId', async (req, res) => {
    const { userId, classId } = req.params;
    //console.log(req.params);

    try {
        // First, verify that the class belongs to the user
        const classDoc = await Class.findOne({ _id: classId, userId: userId });
        if (!classDoc) {
            return res.status(404).json({ message: 'Class not found for the specified user.' });
        }

        // If the class belongs to the user, query for the Grade document
        const grade = await Grade.findOne({ class: classId }).populate('class', 'userId');
        if (!grade) {
            return res.status(405).json({ message: 'Grade not found for the specified class.' });
        }

        // If a grade is found, send it back in the response
        res.json(grade);
        //console.log(grade);
    } catch (error) {
        console.error('Failed to retrieve grade:', error);
        res.status(500).json({ message: 'Server error occurred while retrieving grade.' });
    }
});


// POST route to update grades for a class
router.post('/api/saveGrades/:classId', async (req, res) => {
    const { classId } = req.params;
    const {
        grade_type,
        decimal_places,
        grades, // Array of { grade_name, points, max_points, category }
        assignments,
        projects,
        quizzes,
        tests,
        attendance,
        participation,
        letter_grades
    } = req.body;

    // Validate classId
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).send({ message: 'Invalid class ID.' });
    }

    try {
        // Remove existing grades for the class
        await Grade.deleteMany({ class: classId });

        // Create new Grade document
        const newGrade = new Grade({
            class: classId,
            grade_name: grades.map(grade => grade.grade_name),
            points: grades.map(grade => grade.points),
            max_points: grades.map(grade => grade.max_points),
            category: grades.map(grade => grade.category),
            grade_type,
            decimal_places,
            assignments,
            projects,
            quizzes,
            tests,
            attendance,
            participation,
            letter_grades
        });

        // Save the new Grade document
        await newGrade.save();

        res.status(201).send({ message: 'Grades updated successfully.', grade: newGrade });
    } catch (error) {
        console.error('Error updating grades:', error);
        res.status(500).send({ message: 'Failed to update grades.' });
    }
});

router.put('/api/classSave/:classId', async (req, res) => {
    const { classId } = req.params;
    const { total_grade, total_grade_letter } = req.body;

    try {
        // Ensure classId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).send('Invalid class ID.');
        }

        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { $set: { total_grade, total_grade_letter } },
            { new: true, runValidators: true } // options to return the modified document to the then() function and run schema validators
        );

        if (!updatedClass) {
            return res.status(404).send('Class not found.');
        }

        res.json({
            message: 'Class updated successfully',
            class: updatedClass
        });
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).send('An error occurred while updating the class.');
    }
});

// Route to get radio button values for a specific user
router.get('/api/getRadioButtonValues/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const { classfmt, gradefmt, settingfmt } = user;
        res.json({ classfmt, gradefmt, settingfmt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

// Route to save radio button values for a specific user
router.post('/api/saveRadioButtonValues/:userId', async (req, res) => {
    const { userId } = req.params;
    const { classfmt, gradefmt, settingfmt } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        user.classfmt = classfmt;
        user.gradefmt = gradefmt;
        user.settingfmt = settingfmt;
        await user.save();
        res.json({ message: "Radio button values saved successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
