"use client";

import { AppHeader } from "../../../components/layout/app-header";
import { AppFooter } from "../../../components/layout/app-footer";
import { Users } from "lucide-react";
import "./about.css";

export default function AboutPage() {
  return (
    <div className="app-container public-home">
      <AppHeader />
      
      <main className="app-main-about">
        {/* Hero Banner with Collaborative Description */}
        <div className="about-hero">
          <div className="about-hero-pattern" />
          <div className="about-hero-blob" />
          <div className="about-hero-content">
            <div className="about-badge">ABOUT PROJECT</div>
            <h1 className="about-title">Mekong Salt Lab WebGIS</h1>
            <p className="about-subtitle">
              The WebGIS platform was developed through a collaborative effort involving experts in geospatial sciences, environmental assessment, software engineering, database management, and field data collection. The following team members contributed to the design, development, implementation, and operation of the system
            </p>
          </div>
        </div>

        <div className="about-container">
          {/* Project Leadership and Development Team Section */}
          <div className="team-section">
            <div className="team-title-row">
              <Users className="team-icon" size={24} />
              <h2>Project Leadership and Development Team</h2>
            </div>

            {/* Group 1: Leadership & Coordination */}
            <div className="role-group">
              <div className="role-group-header">
                <span className="role-badge leadership-theme">Leadership & Coordination</span>
                <div className="role-line" />
              </div>
              
              <div className="team-members-grid cols-3">
                {/* Member 1: Steven Starman */}
                <div className="member-card leadership-card">
                  <div className="member-header">
                    <div className="member-avatar avatar-leadership">
                    <img src="/contact/steven.jpg" alt="Steven Starman" className="avatar-img" />
                  </div>
                    <div className="member-meta-info">
                      <h3>Steven Starman, MsC</h3>
                      <span className="member-role">Project Coordinator</span>
                      <a href="mailto:steven@kimdelta.org" className="member-email">steven@kimdelta.org</a>
                    </div>
                  </div>
                  <p className="member-desc">
                    Steven serves as the Project Coordinator, providing overall project management and administrative oversight. He facilitates communication among stakeholders, monitors project progress, coordinates resources, and supports the effective implementation of project activities to ensure that objectives are achieved according to schedule.
                  </p>
                </div>

                {/* Member 2: Long KP */}
                <div className="member-card leadership-card">
                  <div className="member-header">
                    <div className="member-avatar avatar-leadership">
                      <img src="/contact/long.jpg" alt="Long KP" className="avatar-img" />
                    </div>
                    <div className="member-meta-info">
                      <h3>Long KP, PhD</h3>
                      <span className="member-role">Project Lead & Chief WebGIS Architect</span>
                      <a href="mailto:Kimlong_phm@tvu.edu.vn" className="member-email">Kimlong_phm@tvu.edu.vn</a>
                    </div>
                  </div>
                  <p className="member-desc">
                    Long serves as the Project Lead and Chief WebGIS Architect, overseeing the conceptualization, design, and implementation of the entire WebGIS platform. He is responsible for defining the technical framework, coordinating multidisciplinary development activities, and ensuring the successful integration of geospatial databases, spatial analysis tools, and web-based visualization services. His leadership guides all technical aspects of the project from planning to deployment.
                  </p>
                </div>

                {/* Member: Dương Hoàng Oanh */}
                <div className="member-card leadership-card">
                  <div className="member-header">
                    <div className="member-avatar avatar-leadership">
                      <img src="/contact/oanh.jpg" alt="Dương Hoàng Oanh" className="avatar-img" />
                    </div>
                    <div className="member-meta-info">
                      <h3>Dương Hoàng Oanh, M.Sc.</h3>
                      <span className="member-role">Aquaculture and Environmental Data Specialist</span>
                    </div>
                  </div>
                  <p className="member-desc">
                    Ms. Dương Hoàng Oanh is responsible for providing scientific expertise in aquaculture systems, aquatic ecosystems, and environmental monitoring. She contributes to the development and validation of aquaculture-related datasets, supports spatial analysis of aquatic resources, and advises on the integration of environmental and fisheries information into the WebGIS platform. Her role includes data quality assurance, interpretation of aquaculture and ecosystem indicators, and supporting the design of decision-support tools for sustainable resource management and environmental assessment.
                  </p>
                </div>
              </div>
            </div>

            {/* Group 2: WebGIS & GIS Development */}
            <div className="role-group">
              <div className="role-group-header">
                <span className="role-badge webgis-theme">WebGIS & GIS Development</span>
                <div className="role-line" />
              </div>
              
              <div className="team-members-grid cols-3">
                {/* Member 8: L.NP Khanh */}
                <div className="member-card">
                  <div className="member-header">
                    <div className="member-avatar">
                      <img src="/contact/khanh.jpg" alt="L.NP Khanh" className="avatar-img" />
                    </div>
                    <div className="member-meta-info">
                      <h3>L.NP Khanh, MsC</h3>
                      <span className="member-role">WebGIS Developer & GIS Specialist</span>
                    </div>
                  </div>
                  <p className="member-desc">
                    Khanh focuses on developing and maintaining WebGIS components, enhancing user interfaces, optimizing system performance, conducting GIS analysis, spatial data processing, GIS database development, thematic mapping, geospatial data management, and the preparation of geospatial datasets supporting project objectives.
                  </p>
                </div>

                {/* Member 7: N V.Hoang */}
                <div className="member-card">
                  <div className="member-header">
                    <div className="member-avatar">
                      <img src="/contact/hoang.png" alt="N V.Hoang" className="avatar-img" />
                    </div>
                    <div className="member-meta-info">
                      <h3>N V.Hoang, BsC</h3>
                      <span className="member-role">WebGIS Developer & Data Developer</span>
                    </div>
                  </div>
                  <p className="member-desc">
                    Hoang supports software development, system testing, database management, and technical implementation of WebGIS functionalities.
                  </p>
                </div>

                {/* Member 6: N L.Duy */}
                <div className="member-card">
                  <div className="member-header">
                    <div className="member-avatar">
                      <img src="/contact/duy.png" alt="N L.Duy" className="avatar-img" />
                    </div>
                    
                    <div className="member-meta-info">
                      <h3>N L.Duy, BsC</h3>
                      <span className="member-role">WebGIS Developer & Data Developer</span>
                    </div>
                  </div>
                  <p className="member-desc">
                    Duy participates in WebGIS application development, database implementation, and the integration of spatial and non-spatial datasets into the system.
                  </p>
                </div>
              </div>
            </div>

            {/* Group 3: Data Development */}
            <div className="role-group">
              <div className="role-group-header">
                <span className="role-badge data-theme">Data Development & QA</span>
                <div className="role-line" />
              </div>
              
              <div className="team-members-grid cols-3">
                {/* Member 3: NT Tuu */}
                <div className="member-card">
                  <div className="member-header">
                    <div className="member-avatar">
                      <img src="/contact/tuu.jpg" alt="NT Tuu" className="avatar-img" />
                    </div>
                    <div className="member-meta-info">
                      <h3>NT Tuu, PhD</h3>
                      <span className="member-role">Data Developer</span>
                    </div>
                  </div>
                  <p className="member-desc">
                    Tuu contributes to data management, data processing, database maintenance, data quality control, and the preparation of datasets for WebGIS applications and spatial analysis.
                  </p>
                </div>

                {/* Member 4: Lam T.Thao */}
                <div className="member-card">
                  <div className="member-header">
                    <div className="member-avatar">
                      <img src="/contact/thao.jpg" alt="Lam T.Thao" className="avatar-img" />
                    </div>
                    <div className="member-meta-info">
                      <h3>Lam T.Thao, BsC</h3>
                      <span className="member-role">Data Developer</span>
                    </div>
                  </div>
                  <p className="member-desc">
                    Thao specializes in data preparation, standardization, quality assurance, data collection consolidation, and the development of thematic datasets required for spatial analysis and decision-support applications.
                  </p>
                </div>

                {/* Member 5: DT.Y Linh */}
                <div className="member-card">
                  <div className="member-header">
                    <div className="member-avatar">
                      <img src="/contact/linh.jpg" alt="DT.Y Linh" className="avatar-img" />
                    </div>
                    <div className="member-meta-info">
                      <h3>DT.Y Linh, BsC</h3>
                      <span className="member-role">Data Developer</span>
                    </div>
                  </div>
                  <p className="member-desc">
                    Linh contributes to data management, database development, data quality control, data standardization, data synchronization, and the preparation of structured datasets for WebGIS applications. Responsibilities previously assigned to Thinh and Tuu are consolidated under Linh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
