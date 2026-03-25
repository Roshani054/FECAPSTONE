class LearningDashboard {
    constructor() {
        this.apiUrl = localStorage.getItem('apiUrl') || 'http://127.0.0.1:5000/api/courses';
        this.courses = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.fetchCourses();
        this.updateStatistics();
    }

    setupEventListeners() {
        document.getElementById('openAddCourseBtn').addEventListener('click', () => this.openAddCourseModal());
        document.getElementById('closeAddCourseBtn').addEventListener('click', () => this.closeAddCourseModal());
        document.getElementById('cancelAddCourseBtn').addEventListener('click', () => this.closeAddCourseModal());
        document.getElementById('addCourseForm').addEventListener('submit', (e) => this.handleAddCourse(e));

        document.getElementById('closeEditCourseBtn').addEventListener('click', () => this.closeEditCourseModal());
        document.getElementById('cancelEditCourseBtn').addEventListener('click', () => this.closeEditCourseModal());
        document.getElementById('editCourseForm').addEventListener('submit', (e) => this.handleEditCourse(e));

        document.getElementById('filterStatus').addEventListener('change', () => this.filterCourses());

        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });

        document.getElementById('addCourseModal').addEventListener('click', (e) => {
            if (e.target.id === 'addCourseModal') this.closeAddCourseModal();
        });

        document.getElementById('editCourseModal').addEventListener('click', (e) => {
            if (e.target.id === 'editCourseModal') this.closeEditCourseModal();
        });
    }

    handleNavigation(e) {
        e.preventDefault();
        const page = e.currentTarget.dataset.page;

        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}Page`).classList.add('active');

        if (page === 'progress') {
            this.updateProgressChart();
        }
    }

    async fetchCourses() {
        this.setLoading(true);
    
        try {
            const response = await fetch(this.apiUrl);
    
            if (!response.ok) {
                throw new Error(`Failed to fetch courses: ${response.statusText}`);
            }
    
            this.courses = await response.json();
    
            this.renderDashboard();
            this.renderAllCourses();
            this.updateStatistics();
            this.updateProgressChart();
    
        } catch (error) {
            console.error("Fetch failed:", error);
            this.courses = [];
            this.renderEmptyState();
            this.showMessage(`Failed to load courses: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    renderDashboard() {
        const container = document.getElementById('recentCoursesContainer');

        if (this.courses.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; padding: 40px 20px;">
                    <div class="empty-state-icon">📖</div>
                    <p class="empty-state-text">No courses yet. Add your first course to get started!</p>
                </div>
            `;
            return;
        }

        const recentCourses = this.courses.slice(0, 3);
        container.innerHTML = recentCourses.map(course => this.createCourseCard(course)).join('');
    }

    renderAllCourses() {
        this.filterCourses();
    }

    filterCourses() {
        const filterStatus = document.getElementById('filterStatus').value;
        const container = document.getElementById('allCoursesContainer');

        let filtered = this.courses;
        if (filterStatus) {
            filtered = this.courses.filter(course => course.status === filterStatus);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; padding: 40px 20px;">
                    <div class="empty-state-icon">🔍</div>
                    <p class="empty-state-text">No courses found matching your filter.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(course => this.createCourseCard(course)).join('');
    }

    createCourseCard(course) {
        const statusClass = this.getStatusClass(course.status);
        return `
            <div class="course-card">
                <div class="course-header">
                    <h3 class="course-name">${this.escapeHtml(course.name)}</h3>
                    <span class="course-status ${statusClass}">${course.status}</span>
                </div>
                <p class="course-description">${this.escapeHtml(course.description)}</p>
                <div class="course-meta">
                    <span>🎯 Target: ${this.formatDate(course.target_date)}</span>
                    <span>📅 Created: ${this.formatDate(course.created_at)}</span>
                </div>
                <div class="course-actions">
                    <button class="btn btn-success" onclick="dashboard.openEditCourseModal(${course.id})">Edit</button>
                    <button class="btn btn-danger" onclick="dashboard.deleteCourse(${course.id})">Remove</button>
                </div>
            </div>
        `;
    }

    getStatusClass(status) {
        const classMap = {
            'Not Started': 'status-not-started',
            'In Progress': 'status-in-progress',
            'Completed': 'status-completed'
        };
        return classMap[status] || 'status-not-started';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStatistics() {
        const stats = {
            total: this.courses.length,
            completed: this.courses.filter(c => c.status === 'Completed').length,
            inProgress: this.courses.filter(c => c.status === 'In Progress').length,
            notStarted: this.courses.filter(c => c.status === 'Not Started').length
        };

        document.getElementById('totalCoursesValue').textContent = stats.total;
        document.getElementById('completedCoursesValue').textContent = stats.completed;
        document.getElementById('inProgressCoursesValue').textContent = stats.inProgress;
        document.getElementById('notStartedCoursesValue').textContent = stats.notStarted;
    }

    updateProgressChart() {
        const stats = {
            completed: this.courses.filter(c => c.status === 'Completed').length,
            inProgress: this.courses.filter(c => c.status === 'In Progress').length,
            notStarted: this.courses.filter(c => c.status === 'Not Started').length
        };

        const total = this.courses.length;
        const completedPercent = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

        document.getElementById('overallProgressFill').style.width = completedPercent + '%';
        document.getElementById('overallProgressText').textContent = completedPercent + '% Complete';

        const chartContainer = document.getElementById('progressChart');

        if (total === 0) {
            chartContainer.innerHTML = '<p style="color: var(--text-secondary);">No courses to display</p>';
            return;
        }

        chartContainer.innerHTML = `
            <div class="chart-item">
                <div class="chart-label">Completed</div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${(stats.completed / total) * 100}%; background: var(--success-color);">
                        ${stats.completed}
                    </div>
                </div>
            </div>
            <div class="chart-item">
                <div class="chart-label">In Progress</div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${(stats.inProgress / total) * 100}%; background: var(--warning-color);">
                        ${stats.inProgress}
                    </div>
                </div>
            </div>
            <div class="chart-item">
                <div class="chart-label">Not Started</div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${(stats.notStarted / total) * 100}%; background: #f87171;">
                        ${stats.notStarted}
                    </div>
                </div>
            </div>
        `;
    }

    openAddCourseModal() {
        document.getElementById('addCourseModal').classList.add('active');
    }

    closeAddCourseModal() {
        document.getElementById('addCourseModal').classList.remove('active');
        document.getElementById('addCourseForm').reset();
    }

    async handleAddCourse(e) {
        e.preventDefault();
    
        const courseData = {
            name: document.getElementById('courseName').value.trim(),
            description: document.getElementById('courseDescription').value.trim(),
            target_date: document.getElementById('courseTargetDate').value,
            status: document.getElementById('courseStatus').value
        };
    
        if (!this.validateForm(courseData)) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }
    
        this.setLoading(true);
    
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(courseData)
            });
    
            if (!response.ok) {
                throw new Error(`Failed to add course: ${response.statusText}`);
            }
    
            await response.json();
    
            await this.fetchCourses();
    
            this.closeAddCourseModal();
            this.showMessage('Course added successfully!', 'success');
        } catch (error) {
            console.error('Error adding course:', error);
            this.showMessage(`Failed to add course: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    openEditCourseModal(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (!course) return;

        document.getElementById('editCourseId').value = course.id;
        document.getElementById('editCourseName').value = course.name;
        document.getElementById('editCourseDescription').value = course.description;
        document.getElementById('editCourseTargetDate').value = course.target_date;
        document.getElementById('editCourseStatus').value = course.status;

        document.getElementById('editCourseModal').classList.add('active');
    }

    closeEditCourseModal() {
        document.getElementById('editCourseModal').classList.remove('active');
        document.getElementById('editCourseForm').reset();
    }

    async handleEditCourse(e) {
        e.preventDefault();
    
        const courseId = document.getElementById('editCourseId').value;
        const courseData = {
            name: document.getElementById('editCourseName').value.trim(),
            description: document.getElementById('editCourseDescription').value.trim(),
            target_date: document.getElementById('editCourseTargetDate').value,
            status: document.getElementById('editCourseStatus').value
        };
    
        if (!this.validateForm(courseData)) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }
    
        this.setLoading(true);
    
        try {
            const response = await fetch(`${this.apiUrl}/${courseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(courseData)
            });
    
            if (!response.ok) {
                throw new Error(`Failed to update course: ${response.statusText}`);
            }
    
            await response.json();
            await this.fetchCourses();
    
            this.closeEditCourseModal();
            this.showMessage('Course updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating course:', error);
            this.showMessage(`Failed to update course: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async deleteCourse(courseId) {
        if (!confirm('Are you sure you want to delete this course?')) {
            return;
        }
    
        this.setLoading(true);
    
        try {
            const response = await fetch(`${this.apiUrl}/${courseId}`, {
                method: 'DELETE'
            });
    
            if (!response.ok) {
                throw new Error(`Failed to delete course: ${response.statusText}`);
            }
    
            await this.fetchCourses();
            this.showMessage('Course deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting course:', error);
            this.showMessage(`Failed to delete course: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }
    validateForm(data) {
        return data.name && data.description && data.target_date && data.status;
    }

    showMessage(message, type = 'success') {
        const container = document.getElementById('messageContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        container.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    setLoading(isLoading) {
        const overlay = document.getElementById('loadingOverlay');
        if (isLoading) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    renderEmptyState() {
        const emptyHtml = `
            <div class="empty-state" style="grid-column: 1/-1; padding: 40px 20px;">
                <div class="empty-state-icon">⚠️</div>
                <p class="empty-state-text">Failed to load courses. Please check your API connection.</p>
            </div>
        `;
    
        const recent = document.getElementById('recentCoursesContainer');
        const all = document.getElementById('allCoursesContainer');
    
        if (recent) recent.innerHTML = emptyHtml;
        if (all) all.innerHTML = emptyHtml;
    }
    saveSettings() {
        const apiUrl = document.getElementById('apiUrl').value.trim();

        if (!apiUrl) {
            this.showMessage('Please enter a valid API URL', 'error');
            return;
        }

        localStorage.setItem('apiUrl', apiUrl);
        this.apiUrl = apiUrl;

        this.showMessage('Settings saved successfully!', 'success');
        this.fetchCourses();
    }
}

window.dashboard = new LearningDashboard();

