import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {map} from 'rxjs/operators';
import {DbService} from '../../../+shared/services/db/db.service';
import {Key} from '../../../common/key';
import {createStore, Store} from '../../../common/store/store';
import {MenuService} from '../../../+shared/abstract-components/menu/menu.service';
import {GlobalMenuService} from '../../../+shared/abstract-components/menu/+state/global-menu.service';

export interface PasteState {history: string[]; selectedIndex: number};
const initialState = {history: [], selectedIndex: 0};

@Injectable({
  providedIn: 'root'
})
export class PasteService extends MenuService {
  private readonly DB_NAME = 'paste-history';
  private readonly ID = 'paste-history';

  public static readonly MAX_SIZE_PASTE_HISTORY = 10;

  private store: Store<PasteState> = createStore('paste', initialState);

  private _onSelected = new Subject<string>();
  constructor(private readonly _db: DbService, protected globalMenuService: GlobalMenuService) {
    super('PasteHistory', globalMenuService);
  }

  public onSelectPasteEntry(): Observable<string> {
    return this._onSelected.asObservable();
  }

  public save() {
    this._db.upsert({_id: this.ID, paste: this.store.get(s => s.history)}, this.DB_NAME);
  }

  async loadHistory() {
    await this._db.init(this.DB_NAME);
    const history = await this._db.findOne<{_id: string; paste: string[]}>({_id: this.ID}, this.DB_NAME)
    this.store.update({history: !!history ? history.paste : [], selectedIndex: 0});
  }

  public updateKeyEvent(keyEvent: KeyboardEvent) {
    if (keyEvent.key === Key.ArrowDown) {
      this.store.update(this.nextPasteHistoryItem(this.store.get(s => s), +1));
    }
    if (keyEvent.key === Key.ArrowUp) {
      this.store.update(this.nextPasteHistoryItem(this.store.get(s => s), -1));
    }
    if (keyEvent.key === Key.Enter) {
      const command = this.store.get(s => s.history[s.selectedIndex]);
      this.add(command);
    }
    if (keyEvent.key === Key.Enter) {
      this.pasteSelectedEntry();
    }
  }

  public add(command: string) {
    let pasteHistory = [...this.store.get(s => s.history)];
    const indexOfSameEntry = pasteHistory.indexOf(command);
    if (indexOfSameEntry > -1) {
      pasteHistory.splice(indexOfSameEntry, 1);
    }
    pasteHistory.unshift(command);
    if (pasteHistory.length > PasteService.MAX_SIZE_PASTE_HISTORY) {
      pasteHistory = pasteHistory.slice(0, PasteService.MAX_SIZE_PASTE_HISTORY);
    }
    this.store.update({history: pasteHistory, selectedIndex: 0});
    this.save();
  }

  private nextPasteHistoryItem(state: PasteState, steps: number): Partial<PasteState> {
    let index = state.selectedIndex + steps;
    index = index < 0 || state.history.length === 0 ? state.history.length - 1 : index % state.history.length;
    return {selectedIndex: index};
  }

  pasteEntryAtIndex(index: number) {
    this.store.update({selectedIndex: index});
    this.pasteSelectedEntry();
  }

  private pasteSelectedEntry(){
    this._onSelected.next(this.store.get(s => s.history[s.selectedIndex]));
    this.store.update({selectedIndex: 0});
  }

  selectHistory(): Observable<string[]> {
    return this.store.select(s => s.history);
  }

  selectSelectedIndex(): Observable<number> {
    return this.store.select(s => s.selectedIndex);
  }
}
