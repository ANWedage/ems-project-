const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "QA", "Frontend", "UI/UX"
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // CEO who created it
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'departments' }
);

function getDepartmentModel(tenantConnection) {
  return tenantConnection.models.Department || tenantConnection.model('Department', departmentSchema);
}

module.exports = { getDepartmentModel, departmentSchema };
