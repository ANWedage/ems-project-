const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    audience: {
      type: String,
      enum: ['all', 'team_leaders', 'employees_without_leaders'],
      default: 'all',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'notices' }
);

noticeSchema.index({ createdAt: -1 });

function getNoticeModel(tenantConnection) {
  return tenantConnection.models.Notice || tenantConnection.model('Notice', noticeSchema);
}

module.exports = { getNoticeModel };
