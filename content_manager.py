"""
Portfolio Content Manager
--------------------------
A Streamlit UI for editing the JSON files that power the MyHome portfolio
site, with real image uploads (files are saved to disk, JSON only stores
the relative path — you never type a path by hand).

FOLDER LAYOUT THIS APP EXPECTS (siblings of this content_manager.py file):

    portfolio-root/
      content_manager.py     <- this file
      JSON_Files/
        home.json
        skills.json
        projects.json
        education.json
        experience.json
        csr-images.json
        beyondwork-images.json
      Images/                <- hero photo lands here
      Carousel1/              <- education certification images land here
      CSR/                     <- CSR images land here
      BeyondWork/<Category>/   <- beyond-work images land here, one folder per category

Run with:
    pip install streamlit
    streamlit run content_manager.py
"""

import json
import os
import uuid
from pathlib import Path

import streamlit as st

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent
JSON_DIR = ROOT_DIR / "JSON_Files"
IMAGES_DIR = ROOT_DIR / "Images"
CAROUSEL_DIR = ROOT_DIR / "Carousel1"
CSR_DIR = ROOT_DIR / "CSR"
BEYONDWORK_DIR = ROOT_DIR / "BeyondWork"

FILES = {
    "Home": "home.json",
    "Skills": "skills.json",
    "Projects": "projects.json",
    "Education": "education.json",
    "Experience": "experience.json",
    "CSR": "csr-images.json",
    "Beyond Work": "beyondwork-images.json",
    "Personal Projects": "personal-projects.json",
}

st.set_page_config(page_title="Portfolio Content Manager", page_icon="🗂️", layout="wide")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def load_json(filename):
    path = JSON_DIR / filename
    if not path.exists():
        st.error(f"Couldn't find {path}. Make sure JSON_Files/ sits next to content_manager.py.")
        st.stop()
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filename, data):
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    path = JSON_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    st.toast(f"Saved {filename}", icon="✅")


def save_uploaded_file(uploaded_file, folder: Path, relative_prefix: str):
    """Writes an uploaded file to disk and returns the relative path
    (using forward slashes) the way the JSON files store it, e.g.
    'Carousel1/photo.jpg' or 'BeyondWork/ART/sketch.jpeg'."""
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / uploaded_file.name
    with open(dest, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return f"{relative_prefix}/{uploaded_file.name}"


def new_id():
    return uuid.uuid4().hex[:8]


def ensure_ids(items):
    """Give every dict in a list a stable '_id' key used for widget keys,
    without writing that key back into the saved JSON."""
    for item in items:
        if "_id" not in item:
            item["_id"] = new_id()
    return items


def strip_ids(items):
    return [{k: v for k, v in item.items() if k != "_id"} for item in items]


def init_state(key, loader):
    if key not in st.session_state:
        st.session_state[key] = loader()


def remove_button(items, item, label="🗑 Remove"):
    if st.button(label, key=f"remove_{item['_id']}"):
        items.remove(item)
        st.rerun()


# --------------------------------------------------------------------------
# Header
# --------------------------------------------------------------------------
st.title("🗂️ Portfolio Content Manager")
st.caption(
    "Edit every JSON file behind the site. Upload images directly — they're saved "
    "into the right folder automatically and the JSON only stores the path."
)
st.info(
    "Live numbers: write **{years}** (shows e.g. \"3+\") or **{tenure}** (e.g. \"3 yrs 2 mos\") "
    "anywhere in the text and the site counts it from the career start date (October 2023). "
    "In the Experience timeline, a Duration of **{auto}** is worked out from the Period "
    "(e.g. \"Apr 2026 – Present\")."
)

tabs = st.tabs(list(FILES.keys()))

# ==========================================================================
# HOME
# ==========================================================================
with tabs[0]:
    init_state("home_data", lambda: load_json(FILES["Home"]))
    data = st.session_state["home_data"]

    st.subheader("Hero")
    c1, c2 = st.columns(2)
    with c1:
        data["hero"]["firstName"] = st.text_input("First name", data["hero"]["firstName"])
        data["hero"]["eyebrow"] = st.text_input("Eyebrow (title · location)", data["hero"]["eyebrow"])
        data["hero"]["contact"]["email"] = st.text_input("Email", data["hero"]["contact"]["email"])
        data["hero"]["contact"]["linkedinUrl"] = st.text_input(
            "LinkedIn URL", data["hero"]["contact"]["linkedinUrl"]
        )
        data["hero"]["contact"]["linkedinLabel"] = st.text_input(
            "LinkedIn label", data["hero"]["contact"]["linkedinLabel"]
        )
    with c2:
        data["hero"]["lastName"] = st.text_input("Last name", data["hero"]["lastName"])
        data["hero"]["description"] = st.text_area("Description", data["hero"]["description"], height=120)
        data["hero"]["photoAlt"] = st.text_input("Photo alt text", data["hero"]["photoAlt"])

    st.markdown("**Hero photo**")
    if data["hero"].get("photo"):
        st.caption(f"Current: `{data['hero']['photo']}`")
    photo_upload = st.file_uploader("Upload a new hero photo", type=["jpg", "jpeg", "png", "webp"], key="home_photo")
    if photo_upload is not None:
        data["hero"]["photo"] = save_uploaded_file(photo_upload, IMAGES_DIR, "Images")
        st.success(f"Saved to {data['hero']['photo']}")

    st.divider()
    st.subheader("Profile")
    data["profile"]["eyebrow"] = st.text_input("Profile eyebrow", data["profile"]["eyebrow"])
    data["profile"]["summary"] = st.text_area("Profile summary", data["profile"]["summary"], height=140)

    st.divider()
    st.subheader("Certification")
    cert = data["certification"]
    c1, c2 = st.columns(2)
    with c1:
        cert["eyebrow"] = st.text_input("Eyebrow", cert["eyebrow"], key="cert_eyebrow")
        cert["name"] = st.text_input("Certification name", cert["name"], key="cert_name")
        cert["status"] = st.text_input("Status", cert["status"], key="cert_status")
    with c2:
        cert["issuedDate"] = st.text_input("Issued date", cert["issuedDate"], key="cert_issued")
        cert["validDate"] = st.text_input("Valid until", cert["validDate"], key="cert_valid")

    st.divider()
    if st.button("💾 Save Home", type="primary"):
        save_json(FILES["Home"], data)

# ==========================================================================
# SKILLS
# ==========================================================================
with tabs[1]:
    init_state("skills_data", lambda: load_json(FILES["Skills"]))
    data = st.session_state["skills_data"]
    data["categories"] = ensure_ids(data["categories"])

    data["eyebrow"] = st.text_input("Section eyebrow", data["eyebrow"], key="skills_eyebrow")
    st.divider()

    for cat in list(data["categories"]):
        with st.container(border=True):
            c1, c2, c3 = st.columns([1, 3, 1])
            with c1:
                cat["glyph"] = st.text_input("Glyph", cat.get("glyph", ""), key=f"glyph_{cat['_id']}")
            with c2:
                cat["label"] = st.text_input("Category label", cat.get("label", ""), key=f"label_{cat['_id']}")
            with c3:
                st.write("")
                remove_button(data["categories"], cat, "🗑 Remove category")

            pills_text = st.text_area(
                "Skills (one per line)",
                "\n".join(cat.get("pills", [])),
                key=f"pills_{cat['_id']}",
                height=100,
            )
            cat["pills"] = [p.strip() for p in pills_text.splitlines() if p.strip()]

    if st.button("➕ Add category", key="add_skill_category"):
        data["categories"].append({"_id": new_id(), "glyph": "◆", "label": "New Category", "pills": []})
        st.rerun()

    st.divider()
    if st.button("💾 Save Skills", type="primary"):
        save_json(FILES["Skills"], {"eyebrow": data["eyebrow"], "categories": strip_ids(data["categories"])})

# ==========================================================================
# PROJECTS
# ==========================================================================
with tabs[2]:
    init_state("projects_data", lambda: load_json(FILES["Projects"]))
    data = st.session_state["projects_data"]
    data["projects"] = ensure_ids(data["projects"])

    data["eyebrow"] = st.text_input("Section eyebrow", data["eyebrow"], key="proj_eyebrow")

    st.subheader("Company")
    c1, c2, c3 = st.columns(3)
    with c1:
        data["company"]["role"] = st.text_input("Role", data["company"]["role"], key="proj_role")
    with c2:
        data["company"]["org"] = st.text_input("Organization", data["company"]["org"], key="proj_org")
    with c3:
        data["company"]["period"] = st.text_input("Period", data["company"]["period"], key="proj_period")

    st.divider()
    st.subheader("Projects")

    for proj in list(data["projects"]):
        with st.container(border=True):
            c1, c2 = st.columns([1, 4])
            with c1:
                proj["tag"] = st.text_input("Tag", proj.get("tag", ""), key=f"ptag_{proj['_id']}")
            with c2:
                proj["title"] = st.text_input("Title", proj.get("title", ""), key=f"ptitle_{proj['_id']}")

            points_text = st.text_area(
                "Bullet points (one per line)",
                "\n".join(proj.get("points", [])),
                key=f"ppoints_{proj['_id']}",
                height=140,
            )
            proj["points"] = [p.strip() for p in points_text.splitlines() if p.strip()]
            remove_button(data["projects"], proj, "🗑 Remove project")

    if st.button("➕ Add project"):
        n = len(data["projects"]) + 1
        data["projects"].append({"_id": new_id(), "tag": f"Project {n:02d}", "title": "New Project", "points": []})
        st.rerun()

    st.divider()
    if st.button("💾 Save Projects", type="primary"):
        out = {
            "eyebrow": data["eyebrow"],
            "company": data["company"],
            "projects": strip_ids(data["projects"]),
        }
        save_json(FILES["Projects"], out)

# ==========================================================================
# EDUCATION
# ==========================================================================
with tabs[3]:
    init_state("education_data", lambda: load_json(FILES["Education"]))
    data = st.session_state["education_data"]
    data["stats"] = ensure_ids(data.get("stats", []))
    data["certifications"] = ensure_ids(data.get("certifications", []))

    c1, c2 = st.columns(2)
    with c1:
        data["eyebrow"] = st.text_input("Eyebrow", data["eyebrow"], key="edu_eyebrow")
        data["degree"] = st.text_input("Degree", data["degree"], key="edu_degree")
        data["school"] = st.text_input("School", data["school"], key="edu_school")
    with c2:
        data["honour"] = st.text_input("Honour", data["honour"], key="edu_honour")
        data["certificationsSectionTitle"] = st.text_input(
            "Certifications section title", data["certificationsSectionTitle"], key="edu_cert_title"
        )

    st.divider()
    st.subheader("Stats")
    for stat in list(data["stats"]):
        c1, c2, c3 = st.columns([1, 2, 1])
        with c1:
            stat["value"] = st.text_input("Value", stat.get("value", ""), key=f"statval_{stat['_id']}")
        with c2:
            stat["label"] = st.text_input("Label", stat.get("label", ""), key=f"statlbl_{stat['_id']}")
        with c3:
            st.write("")
            remove_button(data["stats"], stat)
    if st.button("➕ Add stat", key="add_edu_stat"):
        data["stats"].append({"_id": new_id(), "value": "", "label": ""})
        st.rerun()

    st.divider()
    st.subheader("Certifications")
    for cert in list(data["certifications"]):
        with st.container(border=True):
            c1, c2 = st.columns([1, 2])
            with c1:
                if cert.get("image"):
                    img_path = ROOT_DIR / cert["image"]
                    if img_path.exists():
                        st.image(str(img_path), width=160)
                    st.caption(f"`{cert['image']}`")
            with c2:
                cert["alt"] = st.text_input("Alt text", cert.get("alt", ""), key=f"certalt_{cert['_id']}")
                upload = st.file_uploader(
                    "Upload / replace certificate image",
                    type=["jpg", "jpeg", "png", "webp"],
                    key=f"certimg_{cert['_id']}",
                )
                if upload is not None:
                    cert["image"] = save_uploaded_file(upload, CAROUSEL_DIR, "Carousel1")
                    st.success(f"Saved to {cert['image']}")
                remove_button(data["certifications"], cert, "🗑 Remove certification")

    if st.button("➕ Add certification"):
        data["certifications"].append({"_id": new_id(), "image": "", "alt": ""})
        st.rerun()

    st.divider()
    if st.button("💾 Save Education", type="primary"):
        out = {k: v for k, v in data.items()}
        out["stats"] = strip_ids(data["stats"])
        out["certifications"] = strip_ids(data["certifications"])
        save_json(FILES["Education"], out)

# ==========================================================================
# EXPERIENCE
# ==========================================================================
with tabs[4]:
    init_state("experience_data", lambda: load_json(FILES["Experience"]))
    data = st.session_state["experience_data"]
    data["stats"] = ensure_ids(data.get("stats", []))
    data["timeline"] = ensure_ids(data.get("timeline", []))

    data["eyebrow"] = st.text_input("Eyebrow", data["eyebrow"], key="exp_eyebrow")
    data["title"] = st.text_input("Title", data["title"], key="exp_title")
    data["subtitle"] = st.text_area("Subtitle", data["subtitle"], key="exp_subtitle", height=80)

    st.divider()
    st.subheader("Stats")
    for stat in list(data["stats"]):
        c1, c2, c3, c4 = st.columns([1, 1, 2, 1])
        with c1:
            stat["icon"] = st.text_input("Icon", stat.get("icon", ""), key=f"estaticon_{stat['_id']}")
        with c2:
            stat["value"] = st.text_input("Value", stat.get("value", ""), key=f"estatval_{stat['_id']}")
        with c3:
            stat["label"] = st.text_input("Label", stat.get("label", ""), key=f"estatlbl_{stat['_id']}")
        with c4:
            st.write("")
            remove_button(data["stats"], stat)
    if st.button("➕ Add stat", key="add_exp_stat"):
        data["stats"].append({"_id": new_id(), "icon": "star", "value": "", "label": ""})
        st.rerun()

    st.divider()
    st.subheader("Timeline")
    for job in list(data["timeline"]):
        with st.container(border=True):
            c1, c2 = st.columns(2)
            with c1:
                job["role"] = st.text_input("Role", job.get("role", ""), key=f"jrole_{job['_id']}")
                job["company"] = st.text_input("Company", job.get("company", ""), key=f"jcompany_{job['_id']}")
                job["location"] = st.text_input("Location", job.get("location", ""), key=f"jloc_{job['_id']}")
                job["icon"] = st.text_input("Icon", job.get("icon", ""), key=f"jicon_{job['_id']}")
            with c2:
                job["period"] = st.text_input("Period", job.get("period", ""), key=f"jperiod_{job['_id']}")
                job["duration"] = st.text_input("Duration", job.get("duration", ""), key=f"jduration_{job['_id']}")
                job["current"] = st.checkbox("Current role", job.get("current", False), key=f"jcurrent_{job['_id']}")

            job["description"] = st.text_area(
                "Description", job.get("description", ""), key=f"jdesc_{job['_id']}", height=100
            )
            tags_text = st.text_input(
                "Tags (comma separated)",
                ", ".join(job.get("tags", [])),
                key=f"jtags_{job['_id']}",
            )
            job["tags"] = [t.strip() for t in tags_text.split(",") if t.strip()]
            remove_button(data["timeline"], job, "🗑 Remove role")

    if st.button("➕ Add timeline entry"):
        data["timeline"].append(
            {
                "_id": new_id(),
                "role": "New Role",
                "company": "",
                "location": "",
                "period": "",
                "duration": "",
                "current": False,
                "icon": "star",
                "description": "",
                "tags": [],
            }
        )
        st.rerun()

    st.divider()
    if st.button("💾 Save Experience", type="primary"):
        out = {
            "eyebrow": data["eyebrow"],
            "title": data["title"],
            "subtitle": data["subtitle"],
            "stats": strip_ids(data["stats"]),
            "timeline": strip_ids(data["timeline"]),
        }
        save_json(FILES["Experience"], out)

# ==========================================================================
# CSR (list of {image, title, description})
# ==========================================================================
with tabs[5]:
    init_state("csr_data", lambda: ensure_ids(load_json(FILES["CSR"])))
    data = st.session_state["csr_data"]

    for entry in list(data):
        with st.container(border=True):
            c1, c2 = st.columns([1, 2])
            with c1:
                if entry.get("image"):
                    img_path = ROOT_DIR / entry["image"]
                    if img_path.exists():
                        st.image(str(img_path), width=180)
                    st.caption(f"`{entry['image']}`")
                upload = st.file_uploader(
                    "Upload / replace image", type=["jpg", "jpeg", "png", "webp"], key=f"csrimg_{entry['_id']}"
                )
                if upload is not None:
                    entry["image"] = save_uploaded_file(upload, CSR_DIR, "CSR")
                    st.success(f"Saved to {entry['image']}")
            with c2:
                entry["title"] = st.text_input("Title", entry.get("title", ""), key=f"csrtitle_{entry['_id']}")
                entry["description"] = st.text_area(
                    "Description", entry.get("description", ""), key=f"csrdesc_{entry['_id']}", height=100
                )
                remove_button(data, entry, "🗑 Remove entry")

    if st.button("➕ Add CSR activity"):
        data.append({"_id": new_id(), "image": "", "title": "New Activity", "description": ""})
        st.rerun()

    st.divider()
    if st.button("💾 Save CSR", type="primary"):
        save_json(FILES["CSR"], strip_ids(data))

# ==========================================================================
# BEYOND WORK (dict keyed by category -> {icon, description, images: [...]})
# ==========================================================================
with tabs[6]:
    if "beyondwork_data" not in st.session_state:
        raw = load_json(FILES["Beyond Work"])
        # convert dict -> ordered list of category dicts so we can add/remove/reorder
        st.session_state["beyondwork_data"] = [
            {"_id": new_id(), "name": name, **content} for name, content in raw.items()
        ]
    categories = st.session_state["beyondwork_data"]

    for cat in list(categories):
        with st.container(border=True):
            cat["name"] = st.text_input("Category name", cat.get("name", ""), key=f"bwname_{cat['_id']}")
            cat["description"] = st.text_area(
                "Description", cat.get("description", ""), key=f"bwdesc_{cat['_id']}", height=90
            )
            cat["icon"] = st.text_area(
                "Icon SVG markup", cat.get("icon", ""), key=f"bwicon_{cat['_id']}", height=90
            )

            st.markdown(f"**Images** — saved to `BeyondWork/{cat['name']}/`")
            images = cat.get("images", [])
            for i, img in enumerate(list(images)):
                c1, c2 = st.columns([4, 1])
                with c1:
                    img_path = ROOT_DIR / img
                    if img_path.exists():
                        st.image(str(img_path), width=140)
                    st.caption(f"`{img}`")
                with c2:
                    if st.button("🗑 Remove", key=f"bwimgrm_{cat['_id']}_{i}"):
                        images.pop(i)
                        st.rerun()
            cat["images"] = images

            uploads = st.file_uploader(
                "Upload one or more images to this category",
                type=["jpg", "jpeg", "png", "webp"],
                accept_multiple_files=True,
                key=f"bwupload_{cat['_id']}",
            )
            if uploads:
                folder = BEYONDWORK_DIR / cat["name"]
                for up in uploads:
                    rel = save_uploaded_file(up, folder, f"BeyondWork/{cat['name']}")
                    if rel not in cat["images"]:
                        cat["images"].append(rel)
                st.success(f"Added {len(uploads)} image(s)")
                st.rerun()

            remove_button(categories, cat, "🗑 Remove entire category")

    if st.button("➕ Add category", key="add_bw_category"):
        categories.append({"_id": new_id(), "name": "New Category", "icon": "", "description": "", "images": []})
        st.rerun()

    st.divider()
    if st.button("💾 Save Beyond Work", type="primary"):
        out = {}
        for cat in categories:
            out[cat["name"]] = {
                "icon": cat.get("icon", ""),
                "description": cat.get("description", ""),
                "images": cat.get("images", []),
            }
        save_json(FILES["Beyond Work"], out)


# ==========================================================================
# PERSONAL PROJECTS
# ==========================================================================
with tabs[7]:
    init_state("personal_data", lambda: load_json(FILES["Personal Projects"]))
    data = st.session_state["personal_data"]
    data["projects"] = ensure_ids(data.get("projects", []))

    c1, c2 = st.columns([1, 3])
    with c1:
        data["eyebrow"] = st.text_input("Section eyebrow", data.get("eyebrow", "Personal Projects"), key="pp_eyebrow")
    with c2:
        data["intro"] = st.text_input("Intro line", data.get("intro", ""), key="pp_intro")

    st.divider()
    for proj in list(data["projects"]):
        with st.container(border=True):
            c1, c2 = st.columns([1, 4])
            with c1:
                proj["tag"] = st.text_input("Tag", proj.get("tag", ""), key=f"pptag_{proj['_id']}")
            with c2:
                proj["title"] = st.text_input("Title", proj.get("title", ""), key=f"pptitle_{proj['_id']}")
            proj["summary"] = st.text_input("One-line summary", proj.get("summary", ""), key=f"ppsum_{proj['_id']}")
            points_text = st.text_area(
                "Bullet points (one per line)",
                "\n".join(proj.get("points", [])),
                key=f"pppoints_{proj['_id']}",
                height=140,
            )
            proj["points"] = [p.strip() for p in points_text.splitlines() if p.strip()]
            tech_text = st.text_input(
                "Tech tags (comma separated)", ", ".join(proj.get("tech", [])), key=f"pptech_{proj['_id']}"
            )
            proj["tech"] = [t.strip() for t in tech_text.split(",") if t.strip()]
            links_text = st.text_area(
                "Links, one per line as  Label | https://url",
                "\n".join(f"{l.get('label', '')} | {l.get('url', '')}" for l in proj.get("links", [])),
                key=f"pplinks_{proj['_id']}",
                height=80,
            )
            links = []
            for line in links_text.splitlines():
                if "|" in line:
                    label, url = line.split("|", 1)
                    if url.strip():
                        links.append({"label": label.strip() or "Open", "url": url.strip()})
            proj["links"] = links
            remove_button(data["projects"], proj, "🗑 Remove project")

    if st.button("➕ Add personal project"):
        n = len(data["projects"]) + 1
        data["projects"].append({"_id": new_id(), "tag": f"Personal {n:02d}", "title": "New Project",
                                 "summary": "", "points": [], "tech": [], "links": []})
        st.rerun()

    st.divider()
    if st.button("💾 Save Personal Projects", type="primary"):
        save_json(FILES["Personal Projects"], {
            "eyebrow": data["eyebrow"],
            "intro": data["intro"],
            "projects": strip_ids(data["projects"]),
        })
        st.caption("Also add or update the matching entry in portfolio_content.json so the chat assistant knows about it.")

