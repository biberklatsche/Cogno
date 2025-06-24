import {BehaviorSubject, Observable} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';
class RootStore {

  private _stateSubject = new BehaviorSubject<any>(null);

  constructor() {
  }

  destroy(name: string) {
    const state = this._stateSubject.value || {};

    delete state[name];
    this._stateSubject.next(state);
  }

  register<T>(name: string, initialState: T) {
    const state = this._stateSubject.value || {};
    if (!state[name]) {
      state[name] = initialState;
    }
    this._stateSubject.next(state);
  }

  select<T>(selector: (state: any) => T): Observable<T> {
    return this._stateSubject.pipe(
      map(s => selector(s)),
      distinctUntilChanged()
    );
  }

  get<T>(name: string): T {
    return this._stateSubject.value[name];
  }

  update<T>(name: string, newState: T) {
    const rootState = this._stateSubject.value;
    rootState[name] = newState;
    this._stateSubject.next(rootState);
  }

  getStoreIds(): string[] {
    const rootState = this._stateSubject.value;
    return Object.keys(rootState);
  }

  clearAllStores() {
    this._stateSubject = new BehaviorSubject(null);
  }
}

export const rootStore: RootStore = new RootStore();

export class Store<State> {
  protected _id: string;

  public get id(): string {
    return this._id;
  }

  protected store = rootStore;

  constructor(id: string, initialState: State) {
    this._id = id;
    this.store.register(id, initialState);
  }

  private get state(): State {
    return {...this.store.get(this._id)};
  }

  public select<T>(selector: (state: State) => T): Observable<T> {
    return this.selectState().pipe(map(state => selector(state)), distinctUntilChanged());
  }

  public get<T>(selector: (state: State) => T): T {
    return selector(this.state);
  }

  public update(props: Partial<State> | ((state: State) => Partial<State>)): void {
    if (typeof props === 'function') {
      const newPartialState = props({...this.state});
      this.store.update(this._id, {...this.state, ...newPartialState});
    } else {
      this.store.update(this._id, {...this.state, ...props});
    }
  }

  public dispose(): void {
    this.store.destroy(this._id);
  }

  private selectState(): Observable<State> {
    return this.store.select(s => s[this._id]);
  }
}

export function createStore<State>(id: string, initialState: State): Store<State>{
  return new Store<State>(id, initialState);
}

export function upsertArray<T>(compare: keyof T, array: T[], item: T): T[] {
  const index = array.findIndex(s => s[compare] === item[compare]);
  if (index === -1) {
    return [...array, item];
  }
  const newArray = [...array];
  newArray.splice(index, 1, item);
  return newArray;
}
