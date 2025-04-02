const { validationResult } = require('express-validator');
const Task = require('../models/Task');
const mongoose = require('mongoose');

exports.createTask = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getAllTasks = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'taskId', sortOrder = 'asc', search } = req.query;

        const query = {};
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const tasks = await Task.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const totalTasks = await Task.countDocuments(query);
        const totalPages = Math.ceil(totalTasks / limit);

        res.json({
            tasks,
            totalTasks,
            totalPages,
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTask = async (req, res) => {
    try {
        let task;

        // Check if the id is a valid ObjectId format
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            // If it's an ObjectId format, search by _id
            task = await Task.findById(req.params.id);
        } else {
            // Otherwise, try to convert to number for taskId search
            const taskId = parseInt(req.params.id);
            if (isNaN(taskId)) {
                return res.status(400).json({ error: 'Invalid task ID format' });
            }
            task = await Task.findOne({ taskId: taskId });
        }

        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTask = async (req, res) => {
    try {
        let task;

        // Check if the id is a valid ObjectId format
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            // If it's an ObjectId format, update by _id
            task = await Task.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );
        } else {
            // Otherwise, try to convert to number for taskId search
            const taskId = parseInt(req.params.id);
            if (isNaN(taskId)) {
                return res.status(400).json({ error: 'Invalid task ID format' });
            }
            task = await Task.findOneAndUpdate(
                { taskId: taskId },
                req.body,
                { new: true, runValidators: true }
            );
        }

        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json(task);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        let task;

        // Check if the id is a valid ObjectId format
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            // If it's an ObjectId format, delete by _id
            task = await Task.findByIdAndDelete(req.params.id);
        } else {
            // Otherwise, try to convert to number for taskId search
            const taskId = parseInt(req.params.id);
            if (isNaN(taskId)) {
                return res.status(400).json({ error: 'Invalid task ID format' });
            }
            task = await Task.findOneAndDelete({ taskId: taskId });
        }

        if (!task) return res.status(404).json({ error: 'Task not found' });
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.bulkImportJson = async (req, res) => {
    try {
        console.log(req.body)

        // Validate input is an array
        if (!Array.isArray(req.body)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid format: Expected an array of tasks'
            });
        }

        // Validate each task in the array
        const tasksToImport = [];
        const errors = [];

        req.body.forEach((task, index) => {
            if (!task.title) {
                errors.push(`Task at index ${index}: Title is required`);
                return;
            }
            if (!task.dueDate) {
                errors.push(`Task at index ${index}: Due date is required`);
                return;
            }
            if (!task.priority) {
                errors.push(`Task at index ${index}: Priority must be Low, Medium, or High`);
                return;
            }

            tasksToImport.push({
                title: task.title.trim(),
                description: task.description?.trim() || '',
                dueDate: new Date(task.dueDate),
                status: task.status ? task.status : 'Pending',
                priority: task.priority
            });
        });

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation errors',
                details: errors
            });
        }

        // Check for duplicates in the import batch
        const titleMap = {};
        const batchDuplicates = [];

        tasksToImport.forEach(task => {
            if (titleMap[task.title]) {
                batchDuplicates.push(task.title);
            } else {
                titleMap[task.title] = true;
            }
        });

        if (batchDuplicates.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Duplicate titles in import batch',
                duplicates: [...new Set(batchDuplicates)] // Remove duplicates from duplicates list
            });
        }

        // Check for existing titles in database
        const existingTitles = await Task.find({
            title: { $in: tasksToImport.map(t => t.title) }
        }).select('title -_id');

        if (existingTitles.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Some tasks already exist',
                existingTitles: existingTitles.map(t => t.title),
                message: `These tasks already exist: ${existingTitles.map(t => t.title).join(', ')}`
            });
        }

        // Find the highest taskId to use for new tasks
        const lastTask = await Task.findOne().sort({ taskId: -1 });
        let nextTaskId = lastTask ? lastTask.taskId + 1 : 1;

        // Assign taskId to each task
        tasksToImport.forEach(task => {
            task.taskId = nextTaskId++;
        });

        // Insert all tasks
        const result = await Task.insertMany(tasksToImport, { ordered: false });

        res.status(201).json({
            success: true,
            importedCount: result.length,
            tasks: result,
            message: `Successfully imported ${result.length} tasks`
        });

    } catch (error) {
        console.error('Bulk import error:', error);

        // Handle specific duplicate key error after insert attempt
        if (error.writeErrors) {
            const duplicates = error.writeErrors.map(err => err.err.op.title);
            return res.status(400).json({
                success: false,
                error: 'Partial import completed with duplicates',
                duplicates: [...new Set(duplicates)],
                importedCount: error.result.result.nInserted,
                message: `Imported ${error.result.result.nInserted} tasks, but these titles already existed: ${[...new Set(duplicates)].join(', ')}`
            });
        }

        res.status(500).json({
            success: false,
            error: 'Server error during bulk import',
            details: error.message
        });
    }
};
exports.markAsComplete = async (req, res) => {
    try {
        let task;

        // Check if the id is a valid ObjectId format
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            // If it's an ObjectId format, update by _id
            task = await Task.findByIdAndUpdate(
                req.params.id,
                { status: 'Completed' },
                { new: true }
            );
        } else {
            // Otherwise, try to convert to number for taskId search
            const taskId = parseInt(req.params.id);
            if (isNaN(taskId)) {
                return res.status(400).json({ error: 'Invalid task ID format' });
            }
            task = await Task.findOneAndUpdate(
                { taskId: taskId },
                { status: 'Completed' },
                { new: true }
            );
        }

        if (!task) return res.status(404).json({ error: 'Task not found' });

        res.json({
            success: true,
            message: 'Task marked as completed',
            task: task
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};