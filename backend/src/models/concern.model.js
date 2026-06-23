const mongoose = require('mongoose');

const concernSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    username: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['new', 'reviewed'],
      default: 'new',
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'concerns' }
);

concernSchema.index({ createdAt: -1 });

function getConcernModel(tenantConnection) {
  return tenantConnection.models.Concern || tenantConnection.model('Concern', concernSchema);
}

module.exports = { getConcernModel };
