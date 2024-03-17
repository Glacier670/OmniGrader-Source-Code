const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const UserSchema = new Schema({
    name: String,
    email: String,
    password: String,
    verified: Boolean,
    passwordResetToken: String,
    passwordResetTokenExpires: Date,
    classes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class', // Reference to the Class model
    }],
    classfmt: Number,
    gradefmt: Number,
    settingfmt: Number
});

UserSchema.methods.createResetPasswordToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.passwordResetTokenExpires = Date.now() + 3600000;

    console.log(resetToken, this.passwordResetToken);

    return resetToken;
}

const User = mongoose.model('User', UserSchema);

module.exports = User;