const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const classSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model
        required: true
    },
    class_name: {
        type: String,
        required: true
    },
    total_grade: {
        type: Number,
        required: false
    },
    credit_amount: {
        type: Number,
        required: true
    },
    total_grade_letter: {
        type: String,
        required: false
    },
});


const Class = mongoose.model('Class', classSchema);


const gradeSchema = new Schema({
    class: { 
        type: Schema.Types.ObjectId, 
        ref: 'Class', 
        required: true 
    },
    grade_name:[{
        type: String,
        required: false
    }],
    points: [{
        type: Number,
        required: false
    }],
    max_points: [{
        type: Number,
        required: false
    }],
    category: [{
        type: Number,
        required: false
    }],
    grade_type: Number,
    decimal_places: Number,
    assignments: Number,
    projects: Number,
    quizzes: Number,
    tests: Number,
    attendance: Number,
    participation: Number,
    letter_grades: [{ // need 12 params in array
        type: Number,
        required: true
    }]
});

const Grade = mongoose.model('Grade', gradeSchema);

module.exports = { Class, Grade };