import AuthScreen from '../auth/AuthScreen.jsx';
import TaskDetailPanel from '../tasks/TaskDetailPanel.jsx';
import { CreateTaskForm, TaskCollection } from '../tasks/TaskCollection.jsx';
import TeamDirectory from '../team/TeamDirectory.jsx';
import ProfilePanel from '../profile/ProfilePanel.jsx';
import WorkspaceHeader from './WorkspaceHeader.jsx';

export default function WorkspaceView({
  activeTab,
  assignments,
  assigneeIds,
  authForm,
  comments,
  commentText,
  editingCommentId,
  editingCommentText,
  error,
  handleAddComment,
  handleAssignUsers,
  handleAuthSubmit,
  handleCreateTask,
  handleDeleteComment,
  handleDeleteTask,
  handleRevokeAssignment,
  handleSaveComment,
  handleToggleUserStatus,
  handleUpdateAssignment,
  handleUpdateTask,
  history,
  isRegistering,
  loading,
  onAssigneeIdsChange,
  onBack,
  onChangeAuthForm,
  onChangeCommentText,
  onChangeEditingCommentText,
  onChangeTaskEdit,
  onChangeTaskFilters,
  onChangeTaskForm,
  onChangeTeamSearch,
  onChangeTeamStatus,
  onLogout,
  onOpenTask,
  onPageChangeTask,
  onPageChangeTeam,
  onTabChange,
  onToggleRegistration,
  pageDataTask,
  pageDataTeam,
  searchTeam,
  selectedTask,
  setEditingCommentId,
  statusFilterTeam,
  success,
  taskEdit,
  taskDetailsLoading,
  taskFilters,
  taskForm,
  taskSummary,
  tasks,
  tasksLoading,
  team,
  teamLoading,
  user,
}) {
  if (!tokenIsAuthenticated(user)) {
    return (
      <AuthScreen
        authForm={authForm}
        error={error}
        handleAuthSubmit={handleAuthSubmit}
        isRegistering={isRegistering}
        loading={loading}
        onToggleRegistration={onToggleRegistration}
        setAuthForm={onChangeAuthForm}
        success={success}
      />
    );
  }

  return (
    <div className="dashboard-shell">
      <WorkspaceHeader
        activeTab={activeTab}
        onLogout={onLogout}
        onTabChange={onTabChange}
        taskSummary={taskSummary}
        user={user}
      />

      {error ? <div className="error-box" role="alert">{error}</div> : null}
      {success ? <div className="success-box" role="status">{success}</div> : null}

      {activeTab === 'dashboard' && (
        <section className="content-grid">
          <CreateTaskForm
            form={taskForm}
            loading={loading}
            onChange={onChangeTaskForm}
            onSubmit={handleCreateTask}
          />
          <TaskCollection
            filters={taskFilters}
            isAdmin={user.role === 'admin'}
            loading={tasksLoading}
            onChangeFilters={onChangeTaskFilters}
            onOpenTask={onOpenTask}
            onPageChange={onPageChangeTask}
            pageData={pageDataTask}
            team={team}
            tasks={tasks}
            variant="dashboard"
          />
        </section>
      )}

      {activeTab === 'tasks' && (
        <TaskCollection
          filters={taskFilters}
          isAdmin={user.role === 'admin'}
          loading={tasksLoading}
          onChangeFilters={onChangeTaskFilters}
          onOpenTask={onOpenTask}
          onPageChange={onPageChangeTask}
          pageData={pageDataTask}
          team={team}
          tasks={tasks}
        />
      )}

      {activeTab === 'detail' && selectedTask && taskEdit && (
        <TaskDetailPanel
          assignments={assignments}
          assigneeIds={assigneeIds}
          comments={comments}
          commentText={commentText}
          editingCommentId={editingCommentId}
          editingCommentText={editingCommentText}
          handleAddComment={handleAddComment}
          handleAssignUsers={handleAssignUsers}
          handleDeleteComment={handleDeleteComment}
          handleDeleteTask={handleDeleteTask}
          handleRevokeAssignment={handleRevokeAssignment}
          handleSaveComment={handleSaveComment}
          handleUpdateAssignment={handleUpdateAssignment}
          handleUpdateTask={handleUpdateTask}
          history={history}
          loading={loading}
          onAssigneeIdsChange={onAssigneeIdsChange}
          onBack={onBack}
          onCommentTextChange={onChangeCommentText}
          onEditingCommentChange={onChangeEditingCommentText}
          onTaskEditChange={onChangeTaskEdit}
          selectedTask={selectedTask}
          setEditingCommentId={setEditingCommentId}
          detailsLoading={taskDetailsLoading}
          taskEdit={taskEdit}
          team={team}
          user={user}
        />
      )}

      {activeTab === 'team' && user.role === 'admin' && (
        <TeamDirectory
          isLoading={teamLoading}
          members={team}
          onPageChange={onPageChangeTeam}
          onSearchChange={onChangeTeamSearch}
          onStatusChange={onChangeTeamStatus}
          onToggleStatus={handleToggleUserStatus}
          pagination={pageDataTeam}
          search={searchTeam}
          statusFilter={statusFilterTeam}
          user={user}
          updating={loading}
        />
      )}

      {activeTab === 'profile' && <ProfilePanel user={user} />}
    </div>
  );
}

function tokenIsAuthenticated(user) {
  return Boolean(user);
}
