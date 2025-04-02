const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const taskController = require('../controllers/taskController');

// Validation middleware without default values
const validateTask = [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional(),
    body('dueDate').isISO8601().withMessage('Invalid date format'),
    body('status').optional(),
    body('priority').notEmpty().withMessage('Priority is required')
];

router.post('/', validateTask, taskController.createTask);
router.get('/', taskController.getAllTasks);
router.get('/:id', param('id').isNumeric(), taskController.getTask);
router.put('/:id', validateTask, taskController.updateTask);
router.delete('/:id', param('id').isNumeric(), taskController.deleteTask);
router.post('/bulk-import', taskController.bulkImportJson);
router.patch('/:id/complete', taskController.markAsComplete);

module.exports = router;