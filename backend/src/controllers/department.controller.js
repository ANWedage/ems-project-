const { getDepartmentModel } = require('../models/department.model');
const { getUserModel } = require('../models/user.model');
const { notify } = require('../utils/notify');
const { sendEmail } = require('../utils/email');

/**
 * CEO creates a new department and assigns an existing user as team leader.
 * The assigned user's role becomes 'team_leader'.
 * If a previous leader exists and is being replaced, they revert to 'employee'.
 */
async function createDepartment(req, res) {
  try {
    const { departmentName, teamLeaderId } = req.body;

    if (!departmentName || !teamLeaderId) {
      return res.status(400).json({ message: 'departmentName and teamLeaderId are required' });
    }

    const Department = getDepartmentModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    // Validate the selected leader
    const leader = await User.findById(teamLeaderId);
    if (!leader || !leader.isActive) {
      return res.status(404).json({ message: 'Selected user not found or inactive' });
    }

    // Check if user is already a leader of another department
    const alreadyLeading = await Department.findOne({ teamLeader: teamLeaderId });
    if (alreadyLeading) {
      return res.status(400).json({ message: `This user is already the team leader of "${alreadyLeading.name}"` });
    }

    const department = await Department.create({
      name: departmentName,
      teamLeader: leader._id,
      createdBy: req.user.id,
    });

    // Promote user to team_leader role and assign department.
    // They are also added to `departments[]` so they count as a member
    // of their own department (not just its leader).
    leader.role = 'team_leader';
    leader.department = department._id;
    if (!(leader.departments || []).some((d) => String(d) === String(department._id))) {
      leader.departments = [...(leader.departments || []), department._id];
    }
    await leader.save();

    await notify(req.tenantConnection, {
      recipient: leader._id,
      message: `You have been assigned as team leader of the "${departmentName}" department.`,
      type: 'department_assigned',
      relatedId: department._id,
    });

    if (leader.email) {
      sendEmail({
        to: leader.email,
        subject: `You are now team leader of ${departmentName}`,
        text: `Hi ${leader.fullName || leader.username},\n\nYou have been assigned as the team leader of the "${departmentName}" department.\n\nPlease log out and log back in to access your Team Leader dashboard.`,
      });
    }

    return res.status(201).json({
      message: 'Department created and leader assigned',
      department: { ...department.toObject(), teamLeader: { _id: leader._id, username: leader.username, fullName: leader.fullName } },
    });
  } catch (err) {
    console.error('createDepartment error:', err);
    return res.status(500).json({ message: 'Failed to create department', error: err.message });
  }
}

/**
 * CEO updates a department: can rename it or reassign the team leader.
 * When a leader is changed:
 *   - Old leader → role reverts to 'employee'
 *   - New leader → role becomes 'team_leader'
 */
async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const { departmentName, teamLeaderId } = req.body;

    const Department = getDepartmentModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    const department = await Department.findById(id);
    if (!department) return res.status(404).json({ message: 'Department not found' });

    if (departmentName) department.name = departmentName;

    if (teamLeaderId && teamLeaderId !== String(department.teamLeader)) {
      const newLeader = await User.findById(teamLeaderId);
      if (!newLeader || !newLeader.isActive) {
        return res.status(404).json({ message: 'New leader not found or inactive' });
      }

      // Check new leader not already leading another dept
      const alreadyLeading = await Department.findOne({ teamLeader: teamLeaderId, _id: { $ne: id } });
      if (alreadyLeading) {
        return res.status(400).json({ message: `This user is already the team leader of "${alreadyLeading.name}"` });
      }

      // Demote old leader. Look them up fresh by the CURRENT teamLeader on
      // the department doc (read before we touch anything else), so we
      // never lose track of who needs to be demoted.
      const previousLeaderId = department.teamLeader;
      if (previousLeaderId && String(previousLeaderId) !== String(newLeader._id)) {
        const oldLeader = await User.findById(previousLeaderId);
        if (oldLeader) {
          oldLeader.role = 'employee';
          // Keep them as a member of the department (just no longer its
          // leader). Force `departments[]` to include this department,
          // regardless of whatever it currently holds - this guarantees
          // they keep showing up as a team member even if older data was
          // out of sync with this department before.
          const alreadyMember = (oldLeader.departments || []).some(
            (d) => String(d) === String(department._id)
          );
          if (!alreadyMember) {
            oldLeader.departments = [...(oldLeader.departments || []), department._id];
          }
          await oldLeader.save();
          console.log(`[updateDepartment] Demoted ${oldLeader.username} from leader of "${department.name}"; departments[] now:`, oldLeader.departments);

          await notify(req.tenantConnection, {
            recipient: oldLeader._id,
            message: `You have been removed as team leader of "${department.name}". You are now an employee.`,
            type: 'role_changed',
            relatedId: department._id,
          });

          if (oldLeader.email) {
            sendEmail({
              to: oldLeader.email,
              subject: `Your role has changed in ${department.name}`,
              text: `Hi ${oldLeader.fullName || oldLeader.username},\n\nYou have been removed as team leader of "${department.name}". Your role is now employee.\n\nPlease log out and log back in to access your Employee dashboard.`,
            });
          }
        } else {
          console.warn(`[updateDepartment] Could not find previous leader with id ${previousLeaderId} to demote.`);
        }
      }

      // Promote new leader. They also count as a member of the
      // department they now lead, so add it to their departments[] too.
      newLeader.role = 'team_leader';
      newLeader.department = department._id;
      if (!(newLeader.departments || []).some((d) => String(d) === String(department._id))) {
        newLeader.departments = [...(newLeader.departments || []), department._id];
      }
      await newLeader.save();

      department.teamLeader = newLeader._id;

      await notify(req.tenantConnection, {
        recipient: newLeader._id,
        message: `You have been assigned as team leader of the "${department.name}" department.`,
        type: 'department_assigned',
        relatedId: department._id,
      });

      if (newLeader.email) {
        sendEmail({
          to: newLeader.email,
          subject: `You are now team leader of ${department.name}`,
          text: `Hi ${newLeader.fullName || newLeader.username},\n\nYou have been assigned as the team leader of the "${department.name}" department.\n\nPlease log out and log back in to access your Team Leader dashboard.`,
        });
      }
    }

    await department.save();
    const populated = await Department.findById(id).populate('teamLeader', 'username fullName email');

    return res.json({ message: 'Department updated', department: populated });
  } catch (err) {
    console.error('updateDepartment error:', err);
    return res.status(500).json({ message: 'Failed to update department', error: err.message });
  }
}

async function listDepartments(req, res) {
  try {
    const Department = getDepartmentModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    const departments = await Department.find().populate('teamLeader', 'username fullName email').lean();

    // Attach a live member count for each department. We count distinct
    // department memberships derived from BOTH the new `departments[]`
    // array and the legacy single `department` field, then de-duplicate
    // per user - this way the count is correct even for any user whose
    // `departments[]` hasn't been backfilled yet from older data.
    const counts = await User.aggregate([
      { $match: { role: { $ne: 'ceo' } } },
      {
        $project: {
          allDepts: {
            $setUnion: [
              { $ifNull: ['$departments', []] },
              { $cond: [{ $ifNull: ['$department', false] }, ['$department'], []] },
            ],
          },
        },
      },
      { $unwind: '$allDepts' },
      { $group: { _id: '$allDepts', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    const departmentsWithCounts = departments.map((d) => ({
      ...d,
      memberCount: countMap.get(String(d._id)) || 0,
    }));

    return res.json({ departments: departmentsWithCounts });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list departments', error: err.message });
  }
}

/**
 * CEO deletes a department entirely.
 *  - The team leader (if any) is demoted back to 'employee'.
 *  - Every member loses this department from their `departments[]`.
 *  - Anyone whose primary `department`/`reportsTo` pointed here has it
 *    cleared, or moved to another remaining team if they have one -
 *    same rule used when a team leader removes a single member.
 *  - The department document itself is then removed.
 */
async function deleteDepartment(req, res) {
  try {
    const { id } = req.params;
    const Department = getDepartmentModel(req.tenantConnection);
    const User = getUserModel(req.tenantConnection);

    const department = await Department.findById(id);
    if (!department) return res.status(404).json({ message: 'Department not found' });

    // Demote the current leader, if any.
    if (department.teamLeader) {
      const leader = await User.findById(department.teamLeader);
      if (leader) {
        leader.role = 'employee';
        leader.departments = (leader.departments || []).filter(
          (d) => String(d) !== String(department._id)
        );
        if (leader.department && String(leader.department) === String(department._id)) {
          const nextDept = leader.departments[0] || null;
          leader.department = nextDept;
          leader.reportsTo = null;
          if (nextDept) {
            const nextDeptDoc = await Department.findById(nextDept);
            leader.reportsTo = nextDeptDoc ? nextDeptDoc.teamLeader : null;
          }
        }
        await leader.save();

        await notify(req.tenantConnection, {
          recipient: leader._id,
          message: `The "${department.name}" department has been deleted. You are now an employee.`,
          type: 'role_changed',
          relatedId: null,
        });

        if (leader.email) {
          sendEmail({
            to: leader.email,
            subject: `${department.name} has been removed`,
            text: `Hi ${leader.fullName || leader.username},\n\nThe "${department.name}" department has been deleted by the CEO. Your role is now employee.\n\nPlease log out and log back in to access your Employee dashboard.`,
          });
        }
      }
    }

    // Update every other member who isn't the leader (already handled above).
    const members = await User.find({
      _id: { $ne: department.teamLeader },
      $or: [{ departments: department._id }, { department: department._id }],
    });

    for (const member of members) {
      member.departments = (member.departments || []).filter(
        (d) => String(d) !== String(department._id)
      );
      if (member.department && String(member.department) === String(department._id)) {
        const nextDept = member.departments[0] || null;
        member.department = nextDept;
        member.reportsTo = null;
        if (nextDept) {
          const nextDeptDoc = await Department.findById(nextDept);
          member.reportsTo = nextDeptDoc ? nextDeptDoc.teamLeader : null;
        }
      }
      await member.save();

      await notify(req.tenantConnection, {
        recipient: member._id,
        message: `The "${department.name}" department has been deleted. You have been removed from this team.`,
        type: 'employee_removed',
        relatedId: null,
      });
    }

    await Department.findByIdAndDelete(id);

    return res.json({ message: 'Department deleted' });
  } catch (err) {
    console.error('deleteDepartment error:', err);
    return res.status(500).json({ message: 'Failed to delete department', error: err.message });
  }
}

module.exports = { createDepartment, updateDepartment, listDepartments, deleteDepartment };
