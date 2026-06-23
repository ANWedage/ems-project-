const { getComplaintModel } = require('../models/complaint.model');

/** employee / team_leader: submit a complaint */
async function submitComplaint(req, res) {
  try {
    const { category, message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }
    const Complaint = getComplaintModel(req.tenantConnection);
    const complaint = await Complaint.create({
      submittedBy: req.user.id,
      category: category || 'other',
      message,
    });
    return res.status(201).json({ message: 'Complaint submitted', complaint });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit complaint', error: err.message });
  }
}

/** CEO: list all complaints */
async function listComplaints(req, res) {
  try {
    const Complaint = getComplaintModel(req.tenantConnection);
    const complaints = await Complaint.find()
      .populate('submittedBy', 'username fullName role')
      .sort({ createdAt: -1 });
    const newCount = complaints.filter(c => c.status === 'new').length;
    return res.json({ complaints, newCount });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch complaints', error: err.message });
  }
}

/** employee / team_leader: list own complaints */
async function myComplaints(req, res) {
  try {
    const Complaint = getComplaintModel(req.tenantConnection);
    const complaints = await Complaint.find({ submittedBy: req.user.id }).sort({ createdAt: -1 });
    return res.json({ complaints });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch complaints', error: err.message });
  }
}

/** CEO: update status and/or add reply */
async function updateComplaint(req, res) {
  try {
    const { status, ceoReply } = req.body;
    const validStatuses = ['new', 'in_review', 'resolved'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
    }
    const Complaint = getComplaintModel(req.tenantConnection);
    const update = {};
    if (status) update.status = status;
    if (ceoReply !== undefined) update.ceoReply = ceoReply;
    const complaint = await Complaint.findByIdAndUpdate(req.params.complaintId, update, { new: true })
      .populate('submittedBy', 'username fullName role');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    return res.json({ message: 'Complaint updated', complaint });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update complaint', error: err.message });
  }
}

/** CEO: delete a complaint */
async function deleteComplaint(req, res) {
  try {
    const Complaint = getComplaintModel(req.tenantConnection);
    const complaint = await Complaint.findByIdAndDelete(req.params.complaintId);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    return res.json({ message: 'Complaint deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete complaint', error: err.message });
  }
}

module.exports = { submitComplaint, listComplaints, myComplaints, updateComplaint, deleteComplaint };
