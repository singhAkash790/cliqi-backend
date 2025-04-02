const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    taskId: { type: Number, unique: true },
    title: { type: String, required: true },
    description: String,
    dueDate: { type: Date, required: true },
    status: {
        type: String,
        default: 'pending'
    },
    priority: {
        type: String,
        default: 'medium',
        required: true
    }
});

// Auto-increment taskId
taskSchema.pre('save', async function (next) {
    if (this.isNew) {
        const lastTask = await this.constructor.findOne().sort({ taskId: -1 });
        this.taskId = lastTask ? lastTask.taskId + 1 : 1;
    }
    next();
});

module.exports = mongoose.model('Task', taskSchema);