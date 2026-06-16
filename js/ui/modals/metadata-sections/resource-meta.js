import { Section } from '../section.js';
import { META_SECTIONS } from './registry.js';
import { makeCollapsible, applyTip } from './helpers.js';
import { renderCodesEditor } from '../codes-modal.js';
import { Modal } from '../modal-base.js';

class ResourceMetaSection extends Section {
  build(pending) {
    const questMeta = Modal._svc.questDoc.meta;
    return makeCollapsible({
      testid:      'meta-resource-meta-toggle',
      tip:         { title: 'Questionnaire.meta', body: 'Resource-level metadata: server version ID, source URI, last-updated timestamp, profile declarations, workflow tags, and security labels.', fhir: 'Questionnaire.meta', spec: 'R4' },
      label:       'Resource Meta',
      countFn:     () =>
        (pending.implicitRules ? 1 : 0) +
        (pending.metaVersionId ? 1 : 0) +
        (pending.metaSource    ? 1 : 0) +
        pending.metaProfile.filter(u => u.trim()).length +
        pending.metaTag.filter(c => c.code?.trim()).length +
        pending.metaSecurity.filter(c => c.code?.trim()).length,
      initialOpen: !!(
        pending.implicitRules || pending.metaVersionId || pending.metaSource || questMeta._metaLastUpdated ||
        pending.metaProfile.length || pending.metaTag.length || pending.metaSecurity.length
      ),
      liveUpdate:  true,
      buildBody:   ({ el }) => {
        // ── implicitRules ─────────────────────────────────────────────────────
        const irRow = document.createElement('div');
        irRow.className = 'meta-modal-row';
        const irLbl = document.createElement('label');
        irLbl.className   = 'meta-modal-lbl';
        irLbl.textContent = 'Implicit Rules:';
        applyTip(irLbl, { title: 'Questionnaire.implicitRules', body: 'A URI that declares the set of rules the resource was authored against. Servers that do not understand the rules MUST reject the resource. Rare in practice.', fhir: 'Questionnaire.implicitRules', spec: 'R4' });
        const irInp = document.createElement('input');
        irInp.type           = 'url';
        irInp.className      = 'meta-modal-inp';
        irInp.placeholder    = 'https://example.org/fhir/rules';
        irInp.value          = pending.implicitRules || '';
        irInp.dataset.testid = 'meta-implicit-rules';
        irInp.oninput = () => { pending.implicitRules = irInp.value; };
        irRow.append(irLbl, irInp);
        el.appendChild(irRow);

        // ── versionId ─────────────────────────────────────────────────────────
        const versionIdRow = document.createElement('div');
        versionIdRow.className = 'meta-modal-row';
        const versionIdLbl = document.createElement('label');
        versionIdLbl.className   = 'meta-modal-lbl';
        versionIdLbl.textContent = 'Version ID:';
        applyTip(versionIdLbl, { title: 'meta.versionId', body: 'Server-assigned version counter, incremented on each update. Use Generate to create a local UUID when working outside a server context.', fhir: 'meta.versionId', spec: 'R4' });
        const versionIdWrap = document.createElement('div');
        versionIdWrap.className = 'meta-modal-inp-group';
        const versionIdInp = document.createElement('input');
        versionIdInp.type           = 'text';
        versionIdInp.className      = 'meta-modal-inp';
        versionIdInp.placeholder    = 'e.g. 1 (server-assigned)';
        versionIdInp.value          = pending.metaVersionId;
        versionIdInp.dataset.testid = 'meta-version-id';
        versionIdInp.oninput = () => { pending.metaVersionId = versionIdInp.value; };
        const generateBtn = document.createElement('button');
        generateBtn.type           = 'button';
        generateBtn.className      = 'meta-modal-gen-btn';
        generateBtn.textContent    = 'Generate';
        generateBtn.dataset.testid = 'meta-version-id-generate';
        applyTip(generateBtn, { title: 'Generate UUID', body: 'Replaces the current versionId with a new random UUID v4.' });
        generateBtn.onclick = () => {
          const uuid = crypto.randomUUID();
          versionIdInp.value      = uuid;
          pending.metaVersionId   = uuid;
        };
        versionIdWrap.append(versionIdInp, generateBtn);
        versionIdRow.append(versionIdLbl, versionIdWrap);
        el.appendChild(versionIdRow);

        // ── source ────────────────────────────────────────────────────────────
        const sourceRow = document.createElement('div');
        sourceRow.className = 'meta-modal-row';
        const sourceLbl = document.createElement('label');
        sourceLbl.className   = 'meta-modal-lbl';
        sourceLbl.textContent = 'Source:';
        applyTip(sourceLbl, { title: 'meta.source', body: 'A URI that identifies the system that created or maintains this resource. Helps downstream consumers trace the origin of the questionnaire.', fhir: 'meta.source', spec: 'R4' });
        const sourceInp = document.createElement('input');
        sourceInp.type           = 'url';
        sourceInp.className      = 'meta-modal-inp';
        sourceInp.placeholder    = 'https://example.org/systems/questionnaire-builder';
        sourceInp.value          = pending.metaSource;
        sourceInp.dataset.testid = 'meta-source';
        sourceInp.oninput = () => { pending.metaSource = sourceInp.value; };
        sourceRow.append(sourceLbl, sourceInp);
        el.appendChild(sourceRow);

        // ── lastUpdated (read-only) ───────────────────────────────────────────
        const lastUpdatedRow = document.createElement('div');
        lastUpdatedRow.className = 'meta-modal-row';
        const lastUpdatedLbl = document.createElement('label');
        lastUpdatedLbl.className   = 'meta-modal-lbl';
        lastUpdatedLbl.textContent = 'Last Updated:';
        applyTip(lastUpdatedLbl, { title: 'meta.lastUpdated', body: 'Timestamp of the last server update. Read-only \u2014 always replaced with the current time on export from this builder.', fhir: 'meta.lastUpdated', spec: 'R4' });
        const lastUpdatedVal = document.createElement('span');
        lastUpdatedVal.className        = 'meta-modal-readonly';
        lastUpdatedVal.dataset.testid   = 'meta-last-updated';
        lastUpdatedVal.textContent      = questMeta._metaLastUpdated
          ? questMeta._metaLastUpdated + ' \u2192 refreshed on export'
          : '(not set \u2014 will be written on export)';
        lastUpdatedRow.append(lastUpdatedLbl, lastUpdatedVal);
        el.appendChild(lastUpdatedRow);

        // ── profile[] ────────────────────────────────────────────────────────
        const profileSection = document.createElement('div');
        profileSection.className = 'meta-modal-subsection';
        const profileHdr = document.createElement('div');
        profileHdr.className   = 'meta-modal-subhdr';
        profileHdr.textContent = 'Profiles';
        applyTip(profileHdr, { title: 'meta.profile', body: 'Canonical URLs of profiles this resource claims conformance to. Used by validators and workflow engines to verify the resource against a known StructureDefinition.', fhir: 'meta.profile', spec: 'R4' });
        profileSection.appendChild(profileHdr);
        const renderProfile = () => {
          profileSection.querySelectorAll('.codes-row').forEach(r => r.remove());
          const addBtn = profileSection.querySelector('.codes-add-btn');
          pending.metaProfile.forEach((url, idx) => {
            const row = document.createElement('div');
            row.className = 'codes-row';
            const inp = document.createElement('input');
            inp.type           = 'url';
            inp.className      = 'codes-inp';
            inp.value          = url;
            inp.placeholder    = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire';
            inp.dataset.testid = `meta-profile-url-${idx}`;
            inp.oninput = () => { pending.metaProfile[idx] = inp.value; };
            const rm = document.createElement('button');
            rm.type           = 'button';
            rm.className      = 'codes-remove-btn';
            rm.textContent    = '\u00D7';
            rm.dataset.testid = `meta-profile-remove-${idx}`;
            rm.onclick = () => { pending.metaProfile.splice(idx, 1); renderProfile(); };
            row.append(inp, rm);
            profileSection.insertBefore(row, addBtn);
          });
        };
        const profileAddBtn = document.createElement('button');
        profileAddBtn.type           = 'button';
        profileAddBtn.className      = 'codes-add-btn';
        profileAddBtn.textContent    = '+ Add Profile URL';
        profileAddBtn.dataset.testid = 'meta-profile-add-btn';
        profileAddBtn.onclick = () => { pending.metaProfile.push(''); renderProfile(); };
        profileSection.appendChild(profileAddBtn);
        renderProfile();
        el.appendChild(profileSection);

        // ── tags ─────────────────────────────────────────────────────────────
        const tagSection = document.createElement('div');
        tagSection.className = 'meta-modal-subsection';
        const tagHdr = document.createElement('div');
        tagHdr.className   = 'meta-modal-subhdr';
        tagHdr.textContent = 'Tags';
        applyTip(tagHdr, { title: 'meta.tag', body: 'Tags applied to this resource. Tags may carry workflow information such as review status, sensitivity classification, or processing instructions. Each tag is a Coding (system + code + display).', fhir: 'meta.tag', spec: 'R4' });
        tagSection.appendChild(tagHdr);
        const tagEditor = document.createElement('div');
        tagSection.appendChild(tagEditor);
        renderCodesEditor(pending.metaTag, tagEditor, 'meta-tag', 'tag');
        el.appendChild(tagSection);

        // ── security labels ───────────────────────────────────────────────────
        const secSection = document.createElement('div');
        secSection.className = 'meta-modal-subsection';
        const secHdr = document.createElement('div');
        secHdr.className   = 'meta-modal-subhdr';
        secHdr.textContent = 'Security Labels';
        applyTip(secHdr, { title: 'meta.security', body: 'Security labels applied to this resource. Used to enforce access control, data sensitivity policies, and audit requirements. Each label is a Coding from a security classification system (e.g. HL7 Confidentiality codes).', fhir: 'meta.security', spec: 'R4' });
        secSection.appendChild(secHdr);
        const secEditor = document.createElement('div');
        secSection.appendChild(secEditor);
        renderCodesEditor(pending.metaSecurity, secEditor, 'meta-security', 'security label');
        el.appendChild(secSection);
      },
    });
  }
}

META_SECTIONS.push(new ResourceMetaSection());
