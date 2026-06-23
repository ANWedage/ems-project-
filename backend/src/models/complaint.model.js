const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      enum: ['workplace', 'management', 'harassment', 'technical', 'other'],
      default: 'other',
    },
    message: { type: String, required: true, trim: true },
    ceoReply: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['new', 'in_review', 'resolved'],
      default: 'new',
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'complaints' }
);

complaintSchema.index({ createdAt: -1 });

function getComplaintModel(tenantConnection) {
  return tenantConnection.models.Complaint || tenantConnection.model('Complaint', complaintSchema);
}

module.exports = { getComplaintModel };
