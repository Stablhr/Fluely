import {Types} from 'mongoose';
import {BoardDocument} from '../models/Board.model';
import {boardCollaboratorRepository} from '../repositories/boardCollaborator.repository';
import {userRepository} from '../repositories/user.repository';
import {BoardRole} from '../constants/product';

export type BoardMember = {
  /** The user id, used as the member id by the client. */
  id: string;
  userId: string;
  name: string;
  email: string;
  role: BoardRole;
  status: 'accepted';
};

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
};

function displayName(person: Person | null | undefined): string {
  if (!person) return 'Unknown';
  const full = `${person.firstName} ${person.lastName}`.trim();
  return full || person.email || person.username || 'Unknown';
}

function toMember(
  userId: Types.ObjectId,
  person: Person | null | undefined,
  role: BoardRole
): BoardMember {
  return {
    id: userId.toString(),
    userId: userId.toString(),
    name: displayName(person),
    email: person?.email ?? '',
    role,
    status: 'accepted'
  };
}

/**
 * The assignable roster for a board: the owner plus every accepted
 * collaborator. Pending and declined invitations deliberately never appear --
 * they have no access, so assigning them a card would be meaningless and would
 * leak their invitation details to the whole board.
 */
async function list(board: BoardDocument): Promise<BoardMember[]> {
  const [owner, rows] = await Promise.all([
    userRepository.findById(board.ownerId.toString()),
    boardCollaboratorRepository.listForBoard(board._id)
  ]);

  const accepted = rows.filter(row => row.status === 'accepted');
  const people = await Promise.all(
    accepted.map(row => userRepository.findById(row.userId.toString()))
  );

  return [
    toMember(board.ownerId, owner, 'owner'),
    ...accepted.map((row, index) =>
      toMember(row.userId, people[index], row.role)
    )
  ];
}

/** True only for the owner or an accepted collaborator on this exact board. */
async function isMember(
  board: BoardDocument,
  userId: string
): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;
  const id = new Types.ObjectId(userId);
  if (board.ownerId.equals(id)) return true;
  const row = await boardCollaboratorRepository.find(board._id, id);
  return row?.status === 'accepted';
}

export const boardMemberService = {
  list,
  isMember
};
