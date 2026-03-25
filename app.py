from flask import Flask, request, jsonify
import json
import os
from datetime import datetime

# Configuration
DATA_FILE = "courses.json"
ALLOWED_STATUSES = {"Not Started", "In Progress", "Completed"}

# ------------------------
# Helper functions
# ------------------------

def ensure_data_file():
    """
    Ensure the data file exists.
    If missing, create with an empty structure: {"courses": []}
    This avoids FileNotFoundError on first run.
    """
    if not os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "w") as f:
                json.dump({"courses": []}, f, indent=2)
        except Exception as e:
            # In a simple script, we log to console; we still proceed so the app can show a helpful error later
            print(f"Warning: Could not create data file. {e}")

def load_data():
    """
    Load and return the list of courses from the JSON file.
    Supports two possible structures:
      - {"courses": [ ... ]}
      - [ ... ]
    Returns a Python list (may be empty).
    """
    ensure_data_file()
    try:
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        # Corrupted JSON
        raise ValueError("Data file is not valid JSON.")
    except Exception as e:
        # Other IO errors
        raise e

    if isinstance(data, dict) and "courses" in data and isinstance(data["courses"], list):
        return data["courses"]
    if isinstance(data, list):
        return data
    # Unknown structure
    return []

def save_data(courses):
    """
    Save the given list of courses to the JSON file
    in the structure {"courses": [...]}
    """
    try:
        with open(DATA_FILE, "w") as f:
            json.dump({"courses": courses}, f, indent=2)
    except Exception as e:
        raise e

def find_by_id(courses, cid):
    """Return the course with the given id, or None if not found."""
    for c in courses:
        if c.get("id") == cid:
            return c
    return None

def is_valid_date(date_str):
    """Check if date_str is in YYYY-MM-DD format."""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False

def get_next_id(courses):
    """Return the next id (start at 1)."""
    if not courses:
        return 1
    max_id = max((c.get("id", 0) for c in courses), default=0)
    return max_id + 1

# ------------------------
# Flask App
# ------------------------

app = Flask(__name__)

# 1) Create a new course
@app.route("/api/courses", methods=["POST"])
def create_course():
    """
    Request body (JSON):
    {
        "name": "...",              # required
        "description": "...",       # required
        "target_date": "YYYY-MM-DD",# required
        "status": "Not Started"     # required
    }
    """
    try:
        payload = request.get_json(force=True)
        if not payload:
            return jsonify({"error": "Missing JSON payload"}), 400

        required = ["name", "description", "target_date", "status"]
        missing = [key for key in required if key not in payload or payload[key] in [None, ""]]
        if missing:
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        if payload["status"] not in ALLOWED_STATUSES:
            return jsonify({"error": "Invalid status. Must be one of Not Started, In Progress, Completed"}), 400

        if not is_valid_date(payload["target_date"]):
            return jsonify({"error": "Invalid target_date. Use format YYYY-MM-DD"}), 400

        # Load existing courses and compute new id
        courses = load_data()
        new_id = get_next_id(courses)
        created_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        course = {
            "id": new_id,
            "name": payload["name"],
            "description": payload["description"],
            "target_date": payload["target_date"],
            "status": payload["status"],
            "created_at": created_at
        }

        courses.append(course)
        save_data(courses)
        return jsonify(course), 201

    except ValueError as ve:
        # Handle specific data issues (e.g., invalid JSON structure)
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Internal server error while creating course"}), 500

# 2) Get all courses
@app.route("/api/courses", methods=["GET"])
def get_all_courses():
    """
    Return the full list of courses.
    """
    try:
        courses = load_data()
        return jsonify(courses), 200
    except Exception:
        return jsonify({"error": "Failed to read data file"}), 500

# 3) Get a specific course
# GET /api/courses/ with query parameter id
@app.route("/api/courses/", methods=["GET"], strict_slashes=False)
def get_course_by_id():
    """
    Example: GET /api/courses/?id=3
    Returns 400 if id is missing or invalid, 404 if not found.
    """
    id_param = request.args.get("id")
    if id_param is None:
        return jsonify({"error": "Missing 'id' query parameter to fetch a specific course"}), 400

    try:
        cid = int(id_param)
    except ValueError:
        return jsonify({"error": "Invalid 'id' parameter. It must be an integer"}), 400

    try:
        courses = load_data()
    except Exception:
        return jsonify({"error": "Failed to read data file"}), 500

    course = find_by_id(courses, cid)
    if course is None:
        return jsonify({"error": "Course not found"}), 404

    return jsonify(course), 200

# 4) Update a course
# PUT /api/courses/ (also accepts /api/courses due to strict_slashes=False)
@app.route("/api/courses/", methods=["PUT"], strict_slashes=False)
def update_course():
    """
    Payload must include "id" to identify the course, plus any fields to update:
    {
        "id": 2,
        "name": "New name",          # optional
        "description": "New description",  # optional
        "target_date": "YYYY-MM-DD", # optional
        "status": "In Progress"      # optional
    }
    """
    try:
        payload = request.get_json(force=True)
        if not payload or "id" not in payload:
            return jsonify({"error": "Missing 'id' in payload to identify course"}), 400

        cid = int(payload["id"])

        courses = load_data()
        course = find_by_id(courses, cid)
        if course is None:
            return jsonify({"error": "Course not found"}), 404

        updated = False

        if "name" in payload:
            if not isinstance(payload["name"], str) or not payload["name"].strip():
                return jsonify({"error": "Invalid name"}), 400
            course["name"] = payload["name"]
            updated = True

        if "description" in payload:
            if not isinstance(payload["description"], str) or not payload["description"].strip():
                return jsonify({"error": "Invalid description"}), 400
            course["description"] = payload["description"]
            updated = True

        if "target_date" in payload:
            if not is_valid_date(payload["target_date"]):
                return jsonify({"error": "Invalid target_date. Use YYYY-MM-DD"}), 400
            course["target_date"] = payload["target_date"]
            updated = True

        if "status" in payload:
            if payload["status"] not in ALLOWED_STATUSES:
                return jsonify({"error": "Invalid status. Must be: Not Started, In Progress, Completed"}), 400
            course["status"] = payload["status"]
            updated = True

        if not updated:
            return jsonify({"error": "No valid fields provided for update"}), 400

        save_data(courses)
        return jsonify(course), 200

    except ValueError:
        return jsonify({"error": "Invalid 'id' in payload"}), 400
    except Exception:
        return jsonify({"error": "Internal error updating course"}), 500

# 5) Delete a course
# DELETE /api/courses/ (also accepts /api/courses due to strict_slashes=False)
@app.route("/api/courses/", methods=["DELETE"], strict_slashes=False)
def delete_course():
    """
    Payload must include "id" to identify the course to delete:
    { "id": 3 }
    """
    try:
        payload = request.get_json(force=True)
        if not payload or "id" not in payload:
            return jsonify({"error": "Missing 'id' in payload to identify course"}), 400

        cid = int(payload["id"])
        courses = load_data()
        course = find_by_id(courses, cid)
        if course is None:
            return jsonify({"error": "Course not found"}), 404

        # Remove the course
        courses = [c for c in courses if c.get("id") != cid]
        save_data(courses)
        return jsonify({"message": "Course deleted"}), 200

    except ValueError:
        return jsonify({"error": "Invalid 'id' in payload"}), 400
    except Exception:
        return jsonify({"error": "Internal error deleting course"}), 500

# ------------------------
# Run the app
# ------------------------
if __name__ == "__main__":
    # Ensure data file exists on startup
    ensure_data_file()
    app.run(debug=False)
