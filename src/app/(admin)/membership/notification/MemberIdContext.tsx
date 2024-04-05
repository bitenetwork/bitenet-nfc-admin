import _ from "lodash";
import { Dispatch, createContext, useReducer } from "react";

export const MemberIdContext = createContext<number[]>([]);
export const MemberDispatchContext = createContext<Dispatch<MemberIdAction>>(
  () => {},
);

export function MemberIdProvider({ children }: { children: React.ReactNode }) {
  const [memberIds, dispatch] = useReducer(memberIdReducer, []);
  return (
    <MemberIdContext.Provider value={memberIds}>
      <MemberDispatchContext.Provider value={dispatch}>
        {children}
      </MemberDispatchContext.Provider>
    </MemberIdContext.Provider>
  );
}

export enum MemberIdActionTypes {
  ADD = "ADD",
  REMOVE = "REMOVE",
  CLEAN = "CLEAN",
}

export type MemberIdAction = {
  type: MemberIdActionTypes;
  memberId: number;
};

function memberIdReducer(memberIds: number[], action: MemberIdAction) {
  switch (action.type) {
    case MemberIdActionTypes.ADD: {
      return [...memberIds, action.memberId];
    }
    case MemberIdActionTypes.REMOVE: {
      return _.without(memberIds, action.memberId);
    }
    case MemberIdActionTypes.CLEAN: {
      return [];
    }
    default: {
      throw Error("Unknown action: " + action.type);
    }
  }
}
