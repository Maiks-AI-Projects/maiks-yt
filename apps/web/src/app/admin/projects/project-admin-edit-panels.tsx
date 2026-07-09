import type {
  MilestoneStatus,
  ProjectItemKind,
  ProjectItemStatus,
  ProjectReadModelSource,
  ProjectReadUpdateSource,
  ProjectUpdateStatus
} from "@maiks-yt/domain/projects";

import { formatProjectLabel } from "../../projects/project-read-data";
import {
  defaultUpdateForm,
  formatProjectEstimate,
  itemKinds,
  itemStatuses,
  milestoneStatuses,
  updateStatuses,
  type ItemFormState,
  type MilestoneFormState,
  type UpdateFormState
} from "./project-admin-client.service";

type ManualUpdatesPanelProps = {
  busyAction: string | null;
  createUpdate: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  editUpdate: (update: ProjectReadUpdateSource) => void;
  selectedProject: ProjectReadModelSource;
  selectedUpdate: ProjectReadUpdateSource | null;
  setSelectedUpdateId: (id: string) => void;
  setUpdateForm: React.Dispatch<React.SetStateAction<UpdateFormState>>;
  updateForm: UpdateFormState;
  updateUpdate: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  updateUpdateState: (
    updateId: string,
    patch: Partial<Pick<ProjectReadUpdateSource, "isVisible" | "status">>
  ) => Promise<void>;
};

export const ManualUpdatesPanel = ({
  busyAction,
  createUpdate,
  editUpdate,
  selectedProject,
  selectedUpdate,
  setSelectedUpdateId,
  setUpdateForm,
  updateForm,
  updateUpdate,
  updateUpdateState
}: ManualUpdatesPanelProps): React.ReactNode => (
  <section className="project-admin-panel">
    <div className="project-admin-panel-heading">
      <h2>Manual Updates</h2>
      {selectedUpdate ? (
        <button type="button" className="secondary-action" onClick={() => {
          setSelectedUpdateId("");
          setUpdateForm({
            ...defaultUpdateForm,
            sortOrder: selectedProject.updates.length + 1
          });
        }}>
          New Update
        </button>
      ) : null}
    </div>
    {selectedProject.updates.length === 0 ? (
      <p>No project updates yet.</p>
    ) : (
      <ol className="project-admin-record-list">
        {selectedProject.updates
          .slice()
          .sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
          .map((update) => (
            <li key={update.id}>
              <div>
                <strong>{update.title}</strong>
                <span>{formatProjectLabel(update.status)} / {update.isVisible ? "Visible" : "Hidden"} / {update.isPinned ? "Pinned" : "Unpinned"} / Order {update.sortOrder}</span>
                {update.summary ? <p>{update.summary}</p> : null}
              </div>
              <button type="button" className="secondary-action" onClick={() => editUpdate(update)} disabled={busyAction !== null}>
                Edit
              </button>
              <select value={update.status} onChange={(event) => void updateUpdateState(update.id, { status: event.target.value as ProjectUpdateStatus })} disabled={busyAction !== null}>
                {updateStatuses.map((status) => <option key={status} value={status}>{formatProjectLabel(status)}</option>)}
              </select>
              <label className="project-admin-checkbox">
                <input type="checkbox" checked={update.isVisible} onChange={(event) => void updateUpdateState(update.id, { isVisible: event.target.checked })} disabled={busyAction !== null} />
                Visible
              </label>
            </li>
          ))}
      </ol>
    )}
    <form className="project-admin-inline-form" onSubmit={(event) => selectedUpdate ? void updateUpdate(event) : void createUpdate(event)}>
      <input value={updateForm.title} onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Update title" required maxLength={191} />
      <input value={updateForm.summary} onChange={(event) => setUpdateForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Optional summary" maxLength={280} />
      <select value={updateForm.status} onChange={(event) => setUpdateForm((current) => ({ ...current, status: event.target.value as ProjectUpdateStatus }))}>
        {updateStatuses.map((status) => <option key={status} value={status}>{formatProjectLabel(status)}</option>)}
      </select>
      <input type="number" min={0} value={updateForm.sortOrder} onChange={(event) => setUpdateForm((current) => ({ ...current, sortOrder: event.target.valueAsNumber || 0 }))} aria-label="Update sort order" />
      <label className="project-admin-checkbox">
        <input type="checkbox" checked={updateForm.isVisible} onChange={(event) => setUpdateForm((current) => ({ ...current, isVisible: event.target.checked }))} />
        Visible
      </label>
      <label className="project-admin-checkbox">
        <input type="checkbox" checked={updateForm.isPinned} onChange={(event) => setUpdateForm((current) => ({ ...current, isPinned: event.target.checked }))} />
        Pinned
      </label>
      <input value={updateForm.publishedAt} onChange={(event) => setUpdateForm((current) => ({ ...current, publishedAt: event.target.value }))} placeholder="Published ISO time, optional" />
      <textarea value={updateForm.body} onChange={(event) => setUpdateForm((current) => ({ ...current, body: event.target.value }))} placeholder="Update body" required maxLength={10000} rows={4} />
      <button type="submit" disabled={busyAction !== null}>{selectedUpdate ? "Save Update" : "Add Update"}</button>
    </form>
  </section>
);

type MilestonesPanelProps = {
  busyAction: string | null;
  createMilestone: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  milestoneForm: MilestoneFormState;
  reorderMilestones: () => Promise<void>;
  selectedProject: ProjectReadModelSource;
  setMilestoneForm: React.Dispatch<React.SetStateAction<MilestoneFormState>>;
  updateMilestoneStatus: (milestoneId: string, status: MilestoneStatus) => Promise<void>;
};

export const MilestonesPanel = ({
  busyAction,
  createMilestone,
  milestoneForm,
  reorderMilestones,
  selectedProject,
  setMilestoneForm,
  updateMilestoneStatus
}: MilestonesPanelProps): React.ReactNode => (
  <section className="project-admin-panel">
    <div className="project-admin-panel-heading">
      <h2>Milestones</h2>
      <button type="button" className="secondary-action" onClick={() => void reorderMilestones()} disabled={busyAction !== null || selectedProject.milestones.length === 0}>
        Save Current Order
      </button>
    </div>
    {selectedProject.milestones.length === 0 ? (
      <p>No milestones yet.</p>
    ) : (
      <ol className="project-admin-record-list">
        {selectedProject.milestones
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
          .map((milestone) => (
            <li key={milestone.id}>
              <div>
                <strong>{milestone.title}</strong>
                <span>{formatProjectLabel(milestone.status)} / Order {milestone.sortOrder}</span>
                {milestone.description ? <p>{milestone.description}</p> : null}
              </div>
              <select value={milestone.status} onChange={(event) => void updateMilestoneStatus(milestone.id, event.target.value as MilestoneStatus)} disabled={busyAction !== null}>
                {milestoneStatuses.map((status) => <option key={status} value={status}>{formatProjectLabel(status)}</option>)}
              </select>
            </li>
          ))}
      </ol>
    )}
    <form className="project-admin-inline-form" onSubmit={(event) => void createMilestone(event)}>
      <input value={milestoneForm.title} onChange={(event) => setMilestoneForm((current) => ({ ...current, title: event.target.value }))} placeholder="Milestone title" required maxLength={191} />
      <select value={milestoneForm.status} onChange={(event) => setMilestoneForm((current) => ({ ...current, status: event.target.value as MilestoneStatus }))}>
        {milestoneStatuses.map((status) => <option key={status} value={status}>{formatProjectLabel(status)}</option>)}
      </select>
      <input type="number" min={0} value={milestoneForm.sortOrder} onChange={(event) => setMilestoneForm((current) => ({ ...current, sortOrder: event.target.valueAsNumber || 0 }))} aria-label="Milestone sort order" />
      <textarea value={milestoneForm.description} onChange={(event) => setMilestoneForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" maxLength={2000} rows={2} />
      <button type="submit" disabled={busyAction !== null}>Add Milestone</button>
    </form>
  </section>
);

type ItemsPanelProps = {
  busyAction: string | null;
  createItem: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  itemForm: ItemFormState;
  itemParentOptions: Array<{ id: string; label: string }>;
  reorderItems: () => Promise<void>;
  selectedProject: ProjectReadModelSource;
  setItemForm: React.Dispatch<React.SetStateAction<ItemFormState>>;
  updateItemStatus: (itemId: string, status: ProjectItemStatus) => Promise<void>;
};

export const ItemsPanel = ({
  busyAction,
  createItem,
  itemForm,
  itemParentOptions,
  reorderItems,
  selectedProject,
  setItemForm,
  updateItemStatus
}: ItemsPanelProps): React.ReactNode => (
  <section className="project-admin-panel">
    <div className="project-admin-panel-heading">
      <h2>Non-money Items</h2>
      <button type="button" className="secondary-action" onClick={() => void reorderItems()} disabled={busyAction !== null || selectedProject.items.length === 0}>
        Save Current Order
      </button>
    </div>
    {selectedProject.items.length === 0 ? (
      <p>No project items yet.</p>
    ) : (
      <ol className="project-admin-record-list">
        {selectedProject.items
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
          .map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{formatProjectLabel(item.kind)} / {formatProjectLabel(item.status)} / Qty {item.quantity} / Order {item.sortOrder}</span>
                {formatProjectEstimate(item.estimatedMinorAmount, item.currencyCode) ? (
                  <p>Estimate: {formatProjectEstimate(item.estimatedMinorAmount, item.currencyCode)}</p>
                ) : null}
                {item.description ? <p>{item.description}</p> : null}
              </div>
              <select value={item.status} onChange={(event) => void updateItemStatus(item.id, event.target.value as ProjectItemStatus)} disabled={busyAction !== null}>
                {itemStatuses.map((status) => <option key={status} value={status}>{formatProjectLabel(status)}</option>)}
              </select>
            </li>
          ))}
      </ol>
    )}
    <form className="project-admin-inline-form" onSubmit={(event) => void createItem(event)}>
      <input value={itemForm.title} onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))} placeholder="Item title" required maxLength={191} />
      <select value={itemForm.kind} onChange={(event) => setItemForm((current) => ({ ...current, kind: event.target.value as ProjectItemKind }))}>
        {itemKinds.map((kind) => <option key={kind} value={kind}>{formatProjectLabel(kind)}</option>)}
      </select>
      <select value={itemForm.status} onChange={(event) => setItemForm((current) => ({ ...current, status: event.target.value as ProjectItemStatus }))}>
        {itemStatuses.map((status) => <option key={status} value={status}>{formatProjectLabel(status)}</option>)}
      </select>
      <select value={itemForm.parentItemId} onChange={(event) => setItemForm((current) => ({ ...current, parentItemId: event.target.value }))}>
        <option value="">No parent</option>
        {itemParentOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <input type="number" min={1} value={itemForm.quantity} onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.valueAsNumber || 1 }))} aria-label="Item quantity" />
      <input inputMode="decimal" value={itemForm.estimatedAmountMajor} onChange={(event) => setItemForm((current) => ({ ...current, estimatedAmountMajor: event.target.value }))} placeholder="Estimate 12.34" aria-label="Item price estimate" />
      <input value={itemForm.currencyCode} onChange={(event) => setItemForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase().slice(0, 3) }))} maxLength={3} aria-label="Estimate currency" />
      <input type="number" min={0} value={itemForm.sortOrder} onChange={(event) => setItemForm((current) => ({ ...current, sortOrder: event.target.valueAsNumber || 0 }))} aria-label="Item sort order" />
      <textarea value={itemForm.description} onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" maxLength={2000} rows={2} />
      <button type="submit" disabled={busyAction !== null}>Add Item</button>
    </form>
  </section>
);
