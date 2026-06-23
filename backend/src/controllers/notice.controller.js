const { getNoticeModel } = require('../models/notice.model');
const { getUserModel } = require('../models/user.model');

async function createNotice(req, res) {
  try {
    const { title, content, audience } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    const validAudiences = ['all', 'team_leaders', 'employees_without_leaders'];
    const chosenAudience = validAudiences.includes(audience) ? audience : 'all';

    const Notice = getNoticeModel(req.tenantConnection);
    const notice = await Notice.create({
      title,
      content,
      audience: chosenAudience,
      createdBy: req.user.id,
    });
    return res.status(201).json({ message: 'Notice created', notice });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create notice', error: err.message });
  }
}

async function listNotices(req, res) {
  try {
    const Notice = getNoticeModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    let audienceFilter = {};

    if (req.user.role === 'ceo') {
      // CEO sees all notices they sent (no filter needed)
      audienceFilter = {};
    } else if (req.user.role === 'team_leader') {
      audienceFilter = { audience: { $in: ['all', 'team_leaders'] } };
    } else if (req.user.role === 'employee') {
      const user = await User.findById(req.user.id).select('reportsTo');
      if (user && user.reportsTo) {
        // Has a team leader — only "all" notices
        audienceFilter = { audience: 'all' };
      } else {
        // No team leader — "all" + "employees_without_leaders"
        audienceFilter = { audience: { $in: ['all', 'employees_without_leaders'] } };
      }
    }

    const notices = await Notice.find(audienceFilter)
      .populate('createdBy', 'username fullName')
      .sort({ createdAt: -1 });

    return res.json({ notices });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch notices', error: err.message });
  }
}

async function deleteNotice(req, res) {
  try {
    const Notice = getNoticeModel(req.tenantConnection);
    const notice = await Notice.findById(req.params.noticeId);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    await notice.deleteOne();
    return res.json({ message: 'Notice deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete notice', error: err.message });
  }
}

module.exports = { createNotice, listNotices, deleteNotice };
